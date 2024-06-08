import { segment as se } from 'icqq'
import { RedisClientType } from 'redis'
import { Yunzai } from './bot.js'
import { plugin as p } from './core/index.js'
declare global {
  let redis: RedisClientType
  let Bot: typeof Yunzai.prototype
  let segment: typeof se
  let logger: typeof console
  let plugin: typeof p.prototype
}
