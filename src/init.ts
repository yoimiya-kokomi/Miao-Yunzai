import { existsSync } from 'fs'
import { join } from 'path'
import { configInit } from './config/config'
import { loggerInit } from './config/log'
import { BOT_NAME } from './config'
import { redisInit } from './config/redis'
import { promises } from 'node:fs'
import yaml from 'yaml'
import { CONFIG_INIT_PATH } from './config/system.js'
import { checkRun } from './config/check.js'

/**
 * 检查node_modules
 */
if (!existsSync(join(process.cwd(), './node_modules'))) {
  console.log('未安装依赖。。。。')
  console.log('请先运行命令：pnpm install -P 安装依赖')
  process.exit()
}

/**
 * 初始化配置
 */
configInit()

/**
 * 日志初始化
 */
loggerInit()

/**
 *
 */
logger.mark(`${BOT_NAME} 启动中...`)

/**
 *  初始化客户端
 */
await redisInit()

/**
 * 设置标题
 */
process.title = BOT_NAME

/**
 * 设置时区
 */
process.env.TZ = 'Asia/Shanghai'

/**
 *
 */
process.on('SIGHUP', () => process.exit())

/**
 * 捕获未处理的错误
 */
process.on('uncaughtException', error => {
  if (typeof logger == 'undefined') console.log(error)
  else logger.error(error)
})

/**
 * 捕获未处理的Promise错误
 */
process.on('unhandledRejection', error => {
  if (typeof logger == 'undefined') console.log(error)
  else logger.error(error)
})

/**
 * 退出事件
 */
process.on('exit', async () => {
  if (typeof redis != 'undefined') {
    await redis.save()
  }
  if (typeof logger == 'undefined') {
    console.log(`${BOT_NAME} 已停止运行`)
  } else {
    logger.mark(logger.magenta(`${BOT_NAME} 已停止运行`))
  }
})

/**
 * 添加一些多余的标题内容
 */
let title = BOT_NAME

//
const qq = await promises
  .readFile(`./${CONFIG_INIT_PATH}qq.yaml`, 'utf-8')
  .then(yaml.parse)
  .catch(() => null)

/**
 *
 */
if (qq) {
  title += `@${qq.qq || ''}`
  switch (qq.platform) {
    case 1: {
      title += ' 安卓手机'
      break
    }
    case 2: {
      title += ' aPad'
      break
    }
    case 3: {
      title += ' 安卓手表'
      break
    }
    case 4: {
      title += ' MacOS'
      break
    }
    case 5: {
      title += ' iPad'
      break
    }
    case 6: {
      title += ' Tim'
      break
    }
    default: {
      break
    }
  }
}

/**
 * 设置标题
 */
process.title = title

/**
 * 检查程序
 */
await checkRun()
