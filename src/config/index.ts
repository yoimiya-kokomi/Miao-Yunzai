
import config from './config.js'
import RedisInit from './redis.js'
import QQ from './qq.js'
/**
 * 
 */
export { checkRun } from './check.js'
/**
 * 
 */
export { checkInit, UpdateTitle as checkUpdateTitle } from './init.js'
/**
 * 配置控制器
 */
export const ConfigController = config
/**
 * 创建qq配置
 */
export const createQQ = QQ
/**
 * 初始化redis全局对象
 */
export const redisInit = RedisInit
/**
 * 
 */
export * from './system.js'