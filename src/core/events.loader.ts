import { type Client } from 'icqq'
import lodash from 'lodash'
import * as Events from './events.js'

/**
 * 加载监听事件
 */
class ListenerLoader {
  /**
   *
   */
  client: Client = null

  /**
   *
   * @param listener
   * @param name
   * @returns
   */
  init = (Listener, name: string) => {
    try {
      /**
       *
       */
      const listener = new Listener()
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
    } catch (err) {
      logger.mark(`监听事件错误：${name}`)
      logger.error(err)
    }
  }

  /**
   * 监听事件加载
   * @param client Bot示例
   */
  async load(client: Client) {
    this.client = client
    for (const key in Events) {
      this.init(Events[key], key)
    }
  }
}

/**
 *
 */
export default new ListenerLoader()
