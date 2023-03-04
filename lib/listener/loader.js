import fs from 'node:fs'
import lodash from 'lodash'

/**
 * 加载监听事件
 */
class ListenerLoader {
  /**
   * 监听事件加载
   * @param client Bot示例
   */
  async load (client) {
    this.client = client

    const files = fs.readdirSync('./lib/events').filter(file => file.endsWith('.js'))

    for (let File of files) {
      try {
        let listener = await import(`../events/${File}`)

        /* eslint-disable new-cap */
        if (!listener.default) continue
        listener = new listener.default()
        listener.client = this.client
        const on = listener.once ? 'once' : 'on'

        if (lodash.isArray(listener.event)) {
          listener.event.forEach((type) => {
            const e = listener[type] ? type : 'execute'
            this.client[on](listener.prefix + type, event => listener[e](event))
          })
        } else {
          const e = listener[listener.event] ? listener.event : 'execute'
          this.client[on](listener.prefix + listener.event, event => listener[e](event))
        }
      } catch (e) {
        logger.mark(`监听事件错误：${File}`)
        logger.error(e)
      }
    }
  }
}

export default new ListenerLoader()
