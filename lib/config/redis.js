import cfg from './config.js'
import common from '../common/common.js'
import { createClient } from 'redis'
import { exec } from 'node:child_process'

/**
 * 初始化全局redis客户端
 */
export default async function redisInit () {

  const rc = cfg.redis
  let redisUn = rc.username || ''
  let redisPw = rc.password ? `:${rc.password}` : ''
  if (rc.username || rc.password) redisPw += '@'
  let redisUrl = `redis://${redisUn}${redisPw}${rc.host}:${rc.port}/${rc.db}`

  // 初始化reids
  let client = createClient({ url: redisUrl })

  try {
    logger.mark(`正在连接 Redis...`)
    logger.mark(redisUrl)

    await client.connect()
  } catch (error) {
    let err = error.toString()

    if (err != 'Error: connect ECONNREFUSED 127.0.0.1:6379') {
      logger.error('连接 Redis 失败！')
      process.exit()
    }

    /** windows */
    if (process.platform == 'win32') {
      logger.error('请先启动 Redis')
      logger.error('Window 系统：双击 redis-server.exe 启动')
      process.exit()
    } else {
      let cmd = 'redis-server --save 900 1 --save 300 10 --daemonize yes'
      let arm = await aarch64()
      /** 安卓端自动启动redis */
      if (arm) {
        client = await startRedis(`${cmd}${arm}`, client, redisUrl)
      } else {
        logger.error('请先启动 Redis')
        logger.error(`Redis 启动命令：${cmd} ${arm}`)
        process.exit()
      }
    }
  }

  client.on('error', async (err) => {
    let log = { error: (log) => console.log(log) }
    if (typeof logger != 'undefined') log = logger
    if (err == 'Error: connect ECONNREFUSED 127.0.0.1:6379') {
      if (process.platform == 'win32') {
        log.error('请先启动 Redis')
        log.error('Window 系统：双击 redis-server.exe 启动')
      } else {
        let cmd = 'redis-server --save 900 1 --save 300 10 --daemonize yes'
        let arm = await aarch64()
        log.error('请先启动 Redis')
        log.error(`Redis 启动命令：${cmd} ${arm}`)
      }
    } else {
      log.error(`Redis 错误：${err}`)
    }
    process.exit()
  })

  /** 全局变量 redis */
  global.redis = client

  logger.mark('Redis 连接成功')

  return client
}

async function aarch64 () {
  let tips = ''
  /** 判断arch */
  let arch = await execSync('arch')
  if (arch.stdout && arch.stdout.includes('aarch64')) {
    /** 判断redis版本 */
    let v = await execSync('redis-server -v')
    if (v.stdout) {
      v = v.stdout.match(/v=(\d)./)
      /** 忽略arm警告 */
      if (v && v[1] >= 6) tips = ' --ignore-warnings ARM64-COW-BUG'
    }
  }
  tips = ' --ignore-warnings ARM64-COW-BUG'
  return tips
}

/** 尝试自动启动redis */
async function startRedis (cmd, client, redisUrl) {
  logger.mark('正在启动 Redis...')
  await execSync(cmd)
  await common.sleep(500)
  try {
    /** 重新链接 */
    client = createClient({ url: redisUrl })
    await client.connect()
  } catch (error) {
    let err = error.toString()
    logger.mark(err)
    logger.error('请先启动 Redis')
    logger.error(`Redis 启动命令：${cmd}`)
    process.exit()
  }
  return client
}

async function execSync (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}
