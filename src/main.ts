/**
 *
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
 *
 */
global.Renderer = Renderer

/**
 * run
 */
await Client.run()
