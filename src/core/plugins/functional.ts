import { MessageCallBackType } from './types.js'
import { plugin } from './index.js'
import { EventMap } from 'icqq'

/**
 * 插件super默认值
 */
export const PluginSuperDefine: {
  name?: string
  dsc?: string
  event?: keyof EventMap
  priority?: number
} = {
  name: 'group-app',
  dsc: 'group-dsc',
  event: 'message',
  priority: 9999
}

/**
 * 消息
 */
export class Messages {
  #count = 0
  #rule: {
    reg: RegExp
    fnc: string
  }[] = []

  #init = PluginSuperDefine

  /**
   * 初始化配置
   * @param init 
   */
  constructor(init?: typeof PluginSuperDefine) {
    for (const key in init) {
      if (Object.prototype.hasOwnProperty.call(this.#init, key)) {
        this.#init[key] = init[key]
      }
    }
  }

  /**
   *
   * @param reg
   * @param fnc
   */
  response(reg: RegExp, fnc: MessageCallBackType) {
    this.#count++
    const propName = `prop_${this.#count}`
    this[propName] = fnc
    this.#rule.push({
      reg,
      fnc: propName
    })
  }
  /**
   *
   */
  get ok() {
    const App = this
    class Children extends plugin {
      constructor() {
        super({
          ...App.#init,
          rule: App.#rule
        })
        for (const key of App.#rule) {
          // 确认存在该函数
          if (App[key.fnc] instanceof Function) {
            this[key.fnc] = App[key.fnc].bind(App)
          }
        }
      }
    }
    return Children
  }
}

/**
 * 事件
 */
export class Events {
  /**
   *
   */
  #count = 0

  /**
   *
   */
  #data: {
    [key: string]: typeof plugin
  } = {}

  /**
   *
   * @param val
   */
  use(val: typeof plugin) {
    this.#count++
    this.#data[this.#count] = val
  }

  /**
   *
   */
  get ok() {
    return this.#data
  }
}
