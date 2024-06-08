import cfg from "./config.js"
import common from "../common/common.js"
import { createClient } from "redis"
import { exec } from "node:child_process"

/**
 * 初始化全局redis客户端
 */
export default async function redisInit() {
  const rc = cfg.redis
  const redisUn = rc.username || ""
  let redisPw = rc.password ? `:${rc.password}` : ""
  if (rc.username || rc.password)
    redisPw += "@"
  const redisUrl = `redis://${redisUn}${redisPw}${rc.host}:${rc.port}/${rc.db}`
  let client = createClient({ url: redisUrl })

  try {
    logger.info(`正在连接 ${logger.blue(redisUrl)}`)
    await client.connect()
  } catch (err) {
    logger.error(`Redis 错误：${logger.red(err)}`)

    const cmd = "redis-server --save 900 1 --save 300 10 --daemonize yes" + await aarch64()
    logger.info("正在启动 Redis...")
    await execSync(cmd)
    await common.sleep(1000)

    try {
      client = createClient({ url: redisUrl })
      await client.connect()
    } catch (err) {
      logger.error(`Redis 错误：${logger.red(err)}`)
      logger.error(`请先启动 Redis：${logger.blue(cmd)}`)
      process.exit()
    }
  }

  client.on("error", async err => {
    logger.error(`Redis 错误：${logger.red(err)}`)
    const cmd = "redis-server --save 900 1 --save 300 10 --daemonize yes" + await aarch64()
    logger.error(`请先启动 Redis：${cmd}`)
    process.exit()
  })

  /** 全局变量 redis */
  global.redis = client
  logger.info("Redis 连接成功")
  return client
}

async function aarch64() {
  if (process.platform == "win32")
    return ""
  /** 判断arch */
  const arch = await execSync("uname -m")
  if (arch.stdout && arch.stdout.includes("aarch64")) {
    /** 判断redis版本 */
    let v = await execSync("redis-server -v")
    if (v.stdout) {
      v = v.stdout.match(/v=(\d)./)
      /** 忽略arm警告 */
      if (v && v[1] >= 6)
        return " --ignore-warnings ARM64-COW-BUG"
    }
  }
  return ""
}

function execSync (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}