import fs from "node:fs/promises"
import lodash from "lodash"

/**
 * 加载监听事件
 */
class ListenerLoader {
  /**
   * 监听事件加载
   */
  async load () {
    Bot.makeLog("info", "-----------", "Listener")
    Bot.makeLog("info", "加载监听事件中...", "Listener")
    let eventCount = 0
    for (const file of (await fs.readdir("./lib/events")).filter(file => file.endsWith(".js"))) {
      Bot.makeLog("debug", [`加载监听事件 ${file}`], "Listener")
      try {
        let listener = await import(`../events/${file}`)
        if (!listener.default) continue
        listener = new listener.default()
        const on = listener.once ? "once" : "on"

        if (lodash.isArray(listener.event)) {
          listener.event.forEach((type) => {
            const e = listener[type] ? type : "execute"
            Bot[on](listener.prefix + type, event => listener[e](event))
          })
        } else {
          const e = listener[listener.event] ? listener.event : "execute"
          Bot[on](listener.prefix + listener.event, event => listener[e](event))
        }
        eventCount++
      } catch (err) {
        Bot.makeLog("error", [`监听事件加载错误 ${file}`, err], "Listener")
      }
    }
    Bot.makeLog("info", `加载监听事件[${eventCount}个]`, "Listener")

    Bot.makeLog("info", "-----------", "Adapter")
    Bot.makeLog("info", "加载适配器中...", "Adapter")
    let adapterCount = 0
    for (const adapter of Bot.adapter) {
      try {
        Bot.makeLog("debug", [`加载适配器 ${adapter.name}(${adapter.id})`], "Adapter")
        await adapter.load()
        adapterCount++
      } catch (err) {
        Bot.makeLog("error", [`适配器加载错误 ${adapter.name}(${adapter.id})`, err], "Adapter")
      }
    }
    Bot.makeLog("info", `加载适配器[${adapterCount}个]`, "Adapter")
  }
}

export default new ListenerLoader()