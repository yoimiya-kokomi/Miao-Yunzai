export { checkRun } from './check.js'
import config from './config.js'
export { checkInit, UpdateTitle as checkUpdateTitle } from './init.js'
export const ConfigController = config
import QQ from './qq.js'
export const createQQ = QQ
import RedisInit from './redis.js'
export const redisInit = RedisInit
export * from './system.js'