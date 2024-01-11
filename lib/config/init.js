import setLog from "./log.js"
import redisInit from "./redis.js"
import { checkRun } from "./check.js"
import cfg from "./config.js"

/** 设置标题 */
process.title = `TRSS Yunzai v${cfg.package.version} © 2023 - 2024 TimeRainStarSky`

/** 设置时区 */
process.env.TZ = "Asia/Shanghai"

/** 捕获未处理的错误 */
process.on("uncaughtException", error => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})

/** 捕获未处理的Promise错误 */
process.on("unhandledRejection", (error, promise) => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})

/** 退出事件 */
process.on("exit", code => {
  if (typeof redis != "undefined")
    redis.save()

  if (typeof logger == "undefined")
    console.log(`TRSS-Yunzai 已停止运行 (${code})`)
  else
    logger.mark(logger.magenta(`TRSS-Yunzai 已停止运行 (${code})`))
})

await checkInit()

/** 初始化事件 */
async function checkInit() {
  /** 日志设置 */
  setLog()

  logger.mark("----^_^----")
  logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 启动中...`))
  logger.mark(logger.cyan("https://github.com/TimeRainStarSky/Yunzai"))

  await redisInit()

  checkRun()
}