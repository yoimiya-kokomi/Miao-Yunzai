import cfg from "./config.js"
import { createClient } from "redis"
import { exec } from "node:child_process"

let lock = false
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
  Bot.makeLog("info", `正在连接 ${logger.blue(redisUrl)}`, "Redis")
  return connectRedis(redisUrl)
}

async function connectRedis(redisUrl, cmd) {
  if (lock && !cmd) return
  lock = true

  try {
    global.redis = createClient({ url: redisUrl })
    await redis.connect()
  } catch (err) {
    Bot.makeLog("error", ["连接错误", err], "Redis")
    if (!cmd) return startRedis(redisUrl)
    Bot.makeLog("error", ["请先启动", logger.blue(cmd)], "Redis")
    process.exit(1)
  }

  redis.on("error", err => {
    Bot.makeLog("error", err, "Redis")
    return connectRedis(redisUrl)
  })

  lock = false
  return redis
}

async function startRedis(redisUrl) {
  if (cfg.redis.host != "127.0.0.1") {
    Bot.makeLog("error", `连接失败，请确认连接地址正确`, "Redis")
    process.exit(1)
  }
  const cmd = `redis-server --port ${cfg.redis.port} --save 900 1 --save 300 10 --daemonize yes${await aarch64()}`
  await Bot.exec(cmd)
  await Bot.sleep(1000)
  return connectRedis(redisUrl, cmd)
}

async function aarch64() {
  if (process.platform == "win32" || process.arch != "arm64")
    return ""
  /** 判断redis版本 */
  let v = await Bot.exec("redis-server -v")
  if (v.stdout?.match) {
    v = v.stdout.match(/v=(\d)./)
    /** 忽略arm警告 */
    if (v && v[1] >= 6)
      return " --ignore-warnings ARM64-COW-BUG"
  }
  return ""
}