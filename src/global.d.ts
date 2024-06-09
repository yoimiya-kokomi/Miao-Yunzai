import { segment as se } from 'icqq'
import { RedisClientType } from 'redis'
import { Yunzai } from './bot.js'
import { plugin as p } from './core/index.js'
/**
 * 全局变量声明
 */
declare global {
  var redis: RedisClientType
  var Bot: typeof Yunzai.prototype
  var segment: typeof se
  var plugin: typeof p
  var logger: any
}
