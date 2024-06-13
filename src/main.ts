/**
 * **********
 * 配置初始化
 * **********
 */
import './init.js'
/**
 * 引入模块
 */
import { plugin, segment, Client } from './core/index.js'
import { Renderer } from './utils/index.js'
/**
 * global.plugin
 */
global.plugin = plugin
/**
 * global.segment
 */
global.segment = segment
/**
 * global.Renderer
 */
global.Renderer = Renderer
/**
 * run
 */
await Client.run()
