import PluginsLoader from '../plugins/loader.js'

export default class EventListener {
  /**
   * 事件监听
   * @param data.prefix 事件名称前缀
   * @param data.event 监听的事件
   * @param data.once 是否只监听一次
   */
  constructor (data) {
    this.prefix = data.prefix || ''
    this.event = data.event
    this.once = data.once || false
    this.plugins = PluginsLoader
  }
}
