import log4js from 'log4js'
import chalk from 'chalk'
import cfg from './config.js'
import fs from 'node:fs'

/**
* 设置日志样式
*/
export default function setLog () {
  let file = './logs'
  if (!fs.existsSync(file)) {
    fs.mkdirSync(file)
  }

  /** 调整error日志等级 */
  // log4js.levels.levels[5].level = Number.MAX_VALUE
  // log4js.levels.levels.sort((a, b) => a.level - b.level)

  log4js.configure({
    appenders: {
      console: {
        type: 'console',
        layout: {
          type: 'pattern',
          pattern: '%[[YzBot][%d{hh:mm:ss.SSS}][%4.4p]%] %m'
        }
      },
      command: {
        type: 'dateFile', // 可以是console,dateFile,file,Logstash等
        filename: 'logs/command', // 将会按照filename和pattern拼接文件名
        pattern: 'yyyy-MM-dd.log',
        numBackups: 15,
        alwaysIncludePattern: true,
        layout: {
          type: 'pattern',
          pattern: '[%d{hh:mm:ss.SSS}][%4.4p] %m'
        }
      },
      error: {
        type: 'file',
        filename: 'logs/error.log',
        alwaysIncludePattern: true,
        layout: {
          type: 'pattern',
          pattern: '[%d{hh:mm:ss.SSS}][%4.4p] %m'
        }
      }
    },
    categories: {
      default: { appenders: ['console'], level: cfg.bot.log_level },
      command: { appenders: ['console', 'command'], level: 'warn' },
      error: { appenders: ['console', 'command', 'error'], level: 'error' }
    }
  })

  const defaultLogger = log4js.getLogger('message')
  const commandLogger = log4js.getLogger('command')
  const errorLogger = log4js.getLogger('error')

  /* eslint-disable no-useless-call */
  /** 全局变量 logger */
  global.logger = {
    trace () {
      defaultLogger.trace.call(defaultLogger, ...arguments)
    },
    debug () {
      defaultLogger.debug.call(defaultLogger, ...arguments)
    },
    info () {
      defaultLogger.info.call(defaultLogger, ...arguments)
    },
    // warn及以上的日志采用error策略
    warn () {
      commandLogger.warn.call(defaultLogger, ...arguments)
    },
    error () {
      errorLogger.error.call(errorLogger, ...arguments)
    },
    fatal () {
      errorLogger.fatal.call(errorLogger, ...arguments)
    },
    mark () {
      errorLogger.mark.call(commandLogger, ...arguments)
    }
  }

  logColor()
}

function logColor () {
  logger.chalk = chalk
  logger.red = chalk.red
  logger.green = chalk.green
  logger.yellow = chalk.yellow
  logger.blue = chalk.blue
  logger.magenta = chalk.magenta
  logger.cyan = chalk.cyan
}
