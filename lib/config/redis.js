import YAML from 'yaml'
import fs from 'fs'
import common from '../common/common.js'
import { createClient } from 'redis'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { exec } = require('child_process')

/**
 * 初始化全局redis客户端
 */
export default async function redisInit () {
  logger.mark('连接redis....')
  const file = './config/config/redis.yaml'
  const cfg = YAML.parse(fs.readFileSync(file, 'utf8'))

  let redisUrl = ''
  if (cfg.password) {
    redisUrl = `redis://:${cfg.password}@${cfg.host}:${cfg.port}`
  } else {
    redisUrl = `redis://${cfg.host}:${cfg.port}`
  }

  // 初始化reids
  let client = createClient({ url: redisUrl })

  try {
    await client.connect()
  } catch (error) {
    let err = error.toString()

    if (err != 'Error: connect ECONNREFUSED 127.0.0.1:6379') {
      logger.error('redis链接失败！')
      process.exit()
    }

    /** windows */
    if (process.platform == 'win32') {
      logger.error('请先开启Redis')
      logger.error('window系统：双击redis-server.exe启动')
      process.exit()
    } else {
      let cmd = 'redis-server --save 900 1 --save 300 10 --daemonize yes'
      let arm = await aarch64()
      /** 安卓端自动启动redis */
      if (arm) {
        client = await startRedis(`${cmd}${arm}`, client, redisUrl)
      } else {
        logger.error('请先开启Redis')
        logger.error(`redis启动命令：${cmd} ${arm}`)
        process.exit()
      }
    }
  }

  client.on('error', async (err) => {
    let log = { error: (log) => console.log(log) }
    if (typeof logger != 'undefined') log = logger
    if (err == 'Error: connect ECONNREFUSED 127.0.0.1:6379') {
      if (process.platform == 'win32') {
        log.error('请先开启Redis')
        log.error('window系统：双击redis-server.exe启动')
      } else {
        let cmd = 'redis-server --save 900 1 --save 300 10 --daemonize yes'
        let arm = await aarch64()
        log.error('请先开启Redis')
        log.error(`redis启动命令：${cmd} ${arm}`)
      }
    } else {
      log.error(`redis错误:${err}`)
    }
    process.exit()
  })

  client.select(cfg.db)
  /** 全局变量 redis */
  global.redis = client

  logger.mark('连接redis成功')

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
  logger.mark('尝试启动redis')
  await execSync(cmd)
  await common.sleep(500)
  try {
    /** 重新链接 */
    client = createClient({ url: redisUrl })
    await client.connect()
  } catch (error) {
    let err = error.toString()
    logger.mark(err)
    logger.error('请先开启Redis')
    logger.error(`redis启动命令：${cmd}`)
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
