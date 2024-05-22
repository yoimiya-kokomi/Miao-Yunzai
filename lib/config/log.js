import log4js from "log4js"
import { Chalk } from "chalk"
import cfg from "./config.js"
import fs from "node:fs"

/**
* 设置日志样式
*/
export default function setLog() {
  if (!fs.existsSync("logs"))
    fs.mkdirSync("logs")

  /** 调整error日志等级 */
  // log4js.levels.levels[5].level = Number.MAX_VALUE
  // log4js.levels.levels.sort((a, b) => a.level - b.level)

  log4js.configure({
    appenders: {
      console: {
        type: "console",
        layout: {
          type: "pattern",
          pattern: "%[[%d{hh:mm:ss.SSS}][%4.4p]%]%m"
        }
      },
      command: {
        type: "dateFile", // 可以是console,dateFile,file,Logstash等
        filename: "logs/command", // 将会按照filename和pattern拼接文件名
        pattern: "yyyy-MM-dd.log",
        numBackups: 15,
        alwaysIncludePattern: true,
        layout: {
          type: "pattern",
          pattern: "[%d{hh:mm:ss.SSS}][%4.4p]%m"
        }
      },
      error: {
        type: "file",
        filename: "logs/error.log",
        alwaysIncludePattern: true,
        layout: {
          type: "pattern",
          pattern: "[%d{hh:mm:ss.SSS}][%4.4p]%m"
        }
      }
    },
    categories: {
      default: { appenders: ["console"], level: cfg.bot.log_level },
      command: { appenders: ["console", "command"], level: "warn" },
      error: { appenders: ["console", "command", "error"], level: "error" }
    }
  })

  /** 全局变量 logger */
  const chalk = new Chalk({ level: 3 })
  chalk.logger = {
    defaultLogger: log4js.getLogger("message"),
    commandLogger: log4js.getLogger("command"),
    errorLogger: log4js.getLogger("error"),
    trace(...args) { return this.defaultLogger.trace(...args) },
    debug(...args) { return this.defaultLogger.debug(...args) },
    info(...args) { return this.defaultLogger.info(...args) },
    warn(...args) { return this.commandLogger.warn(...args) },
    error(...args) { return this.errorLogger.error(...args) },
    fatal(...args) { return this.errorLogger.fatal(...args) },
    mark(...args) { return this.commandLogger.mark(...args) },
  }
  const defid = chalk.blue(`[TRSSYz]`)
  for (const i in chalk.logger)
    if (typeof chalk.logger[i] == "function")
      chalk[i] = (...args) => chalk.logger[i](defid, ...args)
  global.logger = chalk
}