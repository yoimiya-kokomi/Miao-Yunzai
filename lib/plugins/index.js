import plugin from "./plugin.js"

export class Messages {
  #event = "message"

  /**
   *
   */
  #count = 0

  /**
   *
   */
  #rule = []

  /**
   * 初始化配置
   * @param init
   */
  constructor(event) {
    this.#event = event
  }

  /**
   *
   * @param reg
   * @param fnc
   */
  use(fnc, values) {
    this.#count++
    const propName = `prop_${this.#count}`
    this[propName] = fnc
    this.#rule.push({
      fnc: propName,
      reg: values[0],
      permission: values[1] ?? "all",
    })
  }

  /**
   *
   */
  get ok() {
    const App = this
    class Children extends plugin {
      constructor() {
        // init
        super(App.#event)
        this.event = App.#event
        this.rule = App.#rule
        for (const key of App.#rule) {
          // 确认存在该函数
          if (App[key.fnc] instanceof Function) {
            // 改变this指向 确保未来废除 fun(e) 后可用
            this[key.fnc] = () => App[key.fnc].call(this, this.e)
          }
        }
      }
    }
    return Children
  }
}
