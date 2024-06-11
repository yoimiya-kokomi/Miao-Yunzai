import { segment as se } from 'icqq'
import { RedisClientType } from 'redis'
import { Yunzai } from './bot.js'
import { plugin as p } from './core/index.js'
import chalk, { type ChalkInstance } from 'chalk'

/**
 *
 */
type LogType = string | Error | unknown

/**
 *
 */
type LoggerType = {
  trace(...arg: LogType[]): any
  debug(...arg: LogType[]): any
  info(...arg: LogType[]): any
  warn(...arg: LogType[]): any
  error(...arg: LogType[]): any
  fatal(...arg: LogType[]): any
  mark(...arg: LogType[]): any
}

/**
 * @deprecated 不推荐使用
 */
type ChalkInstanceType = {
  /**
   * @deprecated 不推荐使用
   */
  red: ChalkInstance.red
  /**
   * @deprecated 不推荐使用
   */
  green: ChalkInstance.green
  /**
   * @deprecated 不推荐使用
   */
  blue: ChalkInstance.blue
  /**
   * @deprecated 不推荐使用
   */
  yellow: ChalkInstance.yellow
  /**
   * @deprecated 不推荐使用
   */
  magenta: ChalkInstance.magenta
  /**
   * @deprecated 不推荐使用
   */
  cyan: ChalkInstance.cyan
}

declare global {
  /**
   * @deprecated 不推荐使用
   */
  var redis: RedisClientType
  /**
   * @deprecated 不推荐使用
   */
  var Bot: typeof Yunzai.prototype
  /**
   * @deprecated 不推荐使用
   */
  var segment: typeof se
  /**
   * @deprecated 不推荐使用
   */
  var plugin: typeof p
  var logger: LoggerType &
    ChalkInstanceType & {
      chalk: ChalkInstance
    }
}
