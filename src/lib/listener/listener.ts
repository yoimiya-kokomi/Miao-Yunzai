import PluginsLoader from '../plugins/loader.js'

/**
 * 
 */
export default class EventListener {
  prefix = ''
  event = null
  once = false
  plugins = PluginsLoader
  /**
   * 事件监听
   * @param data.prefix 事件名称前缀
   * @param data.event 监听的事件
   * @param data.once 是否只监听一次
   */
  constructor({ prefix, event, once }) {
    prefix && (this.prefix = prefix)
    once && (this.once = once)
    this.event = event
  }
}
