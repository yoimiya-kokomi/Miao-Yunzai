import setLog from "./log.js"
import redisInit from "./redis.js"
import cfg from "./config.js"
import chalk from "chalk"

/** 设置标题 */
process.title = `TRSS Yunzai v${cfg.package.version} © 2023 - 2024 TimeRainStarSky`

/** 设置时区 */
process.env.TZ = "Asia/Shanghai"

function log(...args) {
  if (typeof logger == "undefined")
    console.log(...args)
  else
    logger.mark(...args)
}

/** 捕获未处理的错误 */
process.on("uncaughtException", (...args) => log(...args))
/** 捕获未处理的Promise错误 */
process.on("unhandledRejection", (...args) => log(...args))

/** 退出事件 */
process.on("exit", code => {
  if (typeof redis != "undefined")
    redis.save()

  log(chalk.magenta(`TRSS-Yunzai 已停止运行，本次运行时长：${Bot.getTimeDiff()} (${code})`))
})

/** 初始化事件 */

/** 日志设置 */
setLog()

logger.mark("----^_^----")
logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 启动中...`))
logger.mark(logger.cyan("https://github.com/TimeRainStarSky/Yunzai"))

await redisInit()