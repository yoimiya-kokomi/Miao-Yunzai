import setLog from './log.js'
import redisInit from './redis.js'
import { checkRun } from './check.js'
import cfg from './config.js'

/** 设置标题 */
process.title = 'TRSS Yunzai'

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
  if (typeof redis != 'undefined' && typeof test == 'undefined')
    await redis.save()
  logger.mark(logger.magenta('TRSS-Yunzai 已停止运行'))
})

await checkInit()

/** 初始化事件 */
async function checkInit () {
  /** 日志设置 */
  setLog()

  logger.mark('----^_^----')
  logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 启动中...`))
  logger.mark(logger.cyan('https://github.com/TimeRainStarSky/Yunzai'))

  await redisInit()

  checkRun()
}
