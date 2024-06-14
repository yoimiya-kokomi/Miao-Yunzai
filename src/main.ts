import './init.js'
import { plugin, segment, Client } from './core/index.js'
import { Renderer } from './utils/index.js'
import { createQQ } from './config/qq.js'
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
 * 确保所有微任务做好准备后
 * 再进行宏任务
 */
setTimeout(async () => {
  await createQQ()
  /**
   * run
   */
  await Client.run()
}, 0)
