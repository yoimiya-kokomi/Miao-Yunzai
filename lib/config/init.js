import setLog from "./log.js"
import cfg from "./config.js"

/** 设置标题 */
process.title = `TRSS Yunzai v${cfg.package.version} © 2023 - 2024 TimeRainStarSky`

/** 设置时区 */
process.env.TZ = "Asia/Shanghai"

let stack
const exit = process.exit
process.exit = async code => {
  stack = new Error().stack.replace(/.*\n/, "\n")
  if (typeof redis === "object" && redis.process) {
    await Bot.sleep(5000, redis.save())
    redis.process.kill()
  }
  exit(code)
}
for (const i of ["SIGHUP", "SIGTERM"])
  process.on(i, (signal, code) => process.exit(code))

/** 日志设置 */
setLog()

/** 捕获未处理的错误 */
for (const i of ["uncaughtException", "unhandledRejection"])
  process.on(i, e => {
    try {
      Bot.makeLog("error", e, i)
    } catch (err) {
      console.error(i, e, err)
      process.exit()
    }
  })

/** 退出事件 */
process.on("exit", code => Bot.makeLog("mark", logger.magenta(`TRSS-Yunzai 已停止运行，本次运行时长：${Bot.getTimeDiff()} (${code})`) + (stack || new Error().stack.replace(/(.*\n){3}/, "\n")), "exit"))

logger.mark("----^_^----")
logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 启动中...`))
logger.mark(logger.cyan("https://github.com/TimeRainStarSky/Yunzai"))