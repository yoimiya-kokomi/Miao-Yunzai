
import createQQ from './qq.js'
import setLog from './log.js'
import redisInit from './redis.js'
import { checkRun } from './check.js'
import fs from 'fs'

/** 设置标题 */
process.title = 'Yunzai-Bot'
/** 设置时区 */
process.env.TZ = 'Asia/Shanghai'

/** 捕获未处理的Promise错误 */
process.on('unhandledRejection', (error, promise) => {
  let err = error
  if (logger) {
    logger.error(err)
  } else {
    console.log(err)
  }
})

/** 退出事件 */
process.on('exit', async (code) => {
  if (typeof redis != 'undefined' && typeof test == 'undefined') {
    await redis.save()
  }
})

await checkInit()

/** 初始化事件 */
async function checkInit () {
  /** 检查node_modules */
  if (!fs.existsSync('./node_modules') || !fs.existsSync('./node_modules/icqq')) {
    console.log('请先npm install安装')
    process.exit()
  }

  /** 检查qq.yaml */
  await createQQ()

  /** 日志设置 */
  setLog()

  logger.mark('Yunzai-Bot 启动中...')

  await redisInit()

  checkRun()
}
