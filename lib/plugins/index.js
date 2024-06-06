import plugin from "./plugin.js";

/**
 * ********************
 * - 2024-6-4 @柠檬冲水 
 * https://gitee.com/ningmengchongshui
 * ********************
 * 函数式编程语法糖 - 使用示例
 * ********************
 * - apps.js
 * 
 * import { Messages } from "../../lib/plugins/index.js";
 * const message = new Messages()
 * message.response(/^(#|\/)?你好/, async (e) => {
 *   e.reply('你好')
 *   return false
 * })
 * export default message
 * ********************
 * - index.js
 * 
 * // 导入
 * import hello from './apps.js'
 * const event = new Events()
 * event.use(hello.ok)
 * 
 * // 导出
 * const apps = event.ok
 * export { apps }
 * ********************
 */

export const define = {
  name: Date.now,
  dsc: 'plugin',
  event: 'message',
  priority: 999
}

//
export class Messages {
  count = 0
  response(reg, fnc) {
    this.count++
    const propName = `prop_${this.count}`
    this[propName] = fnc
    this.rule.push({
      reg,
      fnc: propName
    })
  }
  get ok() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const App = this
    class Children extends plugin {
      constructor() {
        super({
          ...define,
          rule: App.rule
        })
        for (const key of App.rule) {
          if (App[key.fnc] instanceof Function) {
            this[key.fnc] = App[key.fnc].bind(App)
          }
        }
      }
    }
    return Children
  }
}

// 
export class Events {
  count = 0
  use(val) {
    this.count++
    this.data[this.count] = val
  }
  get ok() {
    return this.data
  }
}

// 
export { plugin };
