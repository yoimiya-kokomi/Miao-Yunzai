import { segment as se } from 'icqq'
import { RedisClientType } from 'redis'
import { Yunzai } from './bot.js'
import { plugin as p } from './core/index.js'
/**
 * 全局变量声明
 */
declare global {
  let redis: RedisClientType
  let Bot: typeof Yunzai.prototype
  let segment: typeof se
  let plugin: typeof p.prototype
  let logger: any
}
