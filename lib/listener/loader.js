import fs from 'node:fs'
import lodash from 'lodash'

/**
 * 加载监听事件
 */
class ListenerLoader {
  /**
   * 监听事件加载
   */
  async load () {
    logger.info("-----------")
    logger.info("加载监听事件中...")
    let eventCount = 0
    for (const file of fs.readdirSync('./lib/events').filter(file => file.endsWith('.js'))) {
      try {
        let listener = await import(`../events/${file}`)
        if (!listener.default) continue
        listener = new listener.default()
        const on = listener.once ? 'once' : 'on'

        if (lodash.isArray(listener.event)) {
          listener.event.forEach((type) => {
            const e = listener[type] ? type : 'execute'
            Bot[on](listener.prefix + type, event => listener[e](event))
          })
        } else {
          const e = listener[listener.event] ? listener.event : 'execute'
          Bot[on](listener.prefix + listener.event, event => listener[e](event))
        }
        eventCount++
      } catch (e) {
        logger.mark(`监听事件错误：${file}`)
        logger.error(e)
      }
    }
    logger.info(`加载监听事件[${eventCount}个]`)

    logger.info("-----------")
    logger.info("加载适配器中...")
    let adapterCount = 0
    for (const file of fs.readdirSync('./lib/adapter').filter(file => file.endsWith('.js'))) {
      try {
        let adapter = await import(`../adapter/${file}`)
        if (!adapter.default) continue
        adapter = new adapter.default()
        await adapter.load()
        adapterCount++
      } catch (e) {
        logger.mark(`加载适配器错误：${file}`)
        logger.error(e)
      }
    }
    logger.info(`加载适配器[${adapterCount}个]`)
  }
}

export default new ListenerLoader()