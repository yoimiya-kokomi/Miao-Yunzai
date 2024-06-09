import lodash from 'lodash'

/**
 * 加载监听事件
 */
class ListenerLoader {
  client = null

  /**
   * 
   * @param listener 
   * @param File 
   * @returns 
   */
  init = (listener, File: string) => {
    try {
      if (!listener.default) return

      /**
        * 
        */
      listener = new listener.default()

      /**
       * 
       */
      listener.client = this.client

      /**
       * 
       */
      const on = listener.once ? 'once' : 'on'

      if (lodash.isArray(listener.event)) {
        listener.event.forEach(type => {
          const e = listener[type] ? type : 'execute'
          this.client[on](listener.prefix + type, event => listener[e](event))
        })
      } else {
        const e = listener[listener.event] ? listener.event : 'execute'
        this.client[on](listener.prefix + listener.event, event =>
          listener[e](event)
        )
      }
    } catch (e) {
      logger.mark(`监听事件错误：${File}`)
      logger.error(e)
    }
  }

  /**
   * 监听事件加载
   * @param client Bot示例
   */
  async load(client) {
    this.client = client

    /**
     * ****************
     * 不可以加载未知代码
     * *****************
     * 防止被代码植入
     */

    this.init(await import('./events/login.js'), './events/login.js')
    this.init(await import('./events/message.js'), './events/message.js')
    this.init(await import('./events/notice.js'), './events/notice.js')
    this.init(await import('./events/offline.js'), './events/offline.js')
    this.init(await import('./events/online.js'), './events/online.js')
    this.init(await import('./events/request.js'), './events/request.js')

  }
}

/**
 *
 */
export default new ListenerLoader()
