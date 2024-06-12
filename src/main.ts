/**
 *
 */
import { plugin, segment, Client } from './core/index.js'
/**
 * global.plugin
 */
global.plugin = plugin
/**
 * global.segment
 */
global.segment = segment
/**
 * run
 */
await Client.run()
