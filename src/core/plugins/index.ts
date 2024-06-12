
import { Common } from '../../miao.js'
import { EventType } from './types.js'

import { type EventMap } from 'icqq'

const State = {}
const SymbolTimeout = Symbol('Timeout')
const SymbolResolve = Symbol('Resolve')

/**
 * 
 */
type PluginSuperType = {
  /**
   * @param name 插件名称
   * @deprecated 已废弃
   */
  name?: string
  /**
   * @param dsc 插件描述
   * @deprecated 已废弃
   */
  dsc?: string
  /**
   * namespace，设置handler时建议设置
   * @deprecated 已废弃
   */
  namespace?: any
  /**
   * @param handler handler配置
   * @param handler.key handler支持的事件key
   * @param handler.fn handler的处理func
   * @deprecated 已废弃
   */
  handler?: any
  /**
   *  task
   *  task.name 定时任务名称
   *  task.cron 定时任务cron表达式
   *  task.fnc 定时任务方法名
   *  task.log  false时不显示执行日志
   * @deprecated 已废弃
   */
  task?: any
  /**
   * 优先级
   */
  priority?: number
  /**
   * 事件
   */
  event?: keyof EventMap
  /**
   *  rule
   *  rule.reg 命令正则
   *  rule.fnc 命令执行方法
   *  rule.event 执行事件，默认message
   *  rule.log  false时不显示执行日志
   *  rule.permission 权限 master,owner,admin,all
   */
  rule?: {
    reg?: RegExp | string,
    fnc?: string,
    event?: keyof EventMap,
    log?: boolean
    permission?: 'master' | 'owner' | 'admin' | 'all'
  }[]
}

export class Plugin {
  name: PluginSuperType['name'] = 'your-plugin'
  dsc: PluginSuperType['dsc'] = '无'
  task: PluginSuperType['task'] = null
  rule: PluginSuperType['rule'] = []
  event: PluginSuperType['event'] = 'message'
  priority: PluginSuperType['priority'] = 9999
  namespace: PluginSuperType['namespace'] = null
  handler: PluginSuperType['handler'] = null
  e: EventType

  /**
   * @param event 执行事件，默认message
   * @param priority 优先级，数字越小优先级越高
   * @param rule 优先级，数字越小优先级越高
   */
  constructor(init?: PluginSuperType) {
    const {
      event,
      priority = 5000,
      rule,
      name,
      dsc,
      handler,
      namespace,
      task,
    } = init
    name && (this.name = name)
    dsc && (this.dsc = dsc)
    event && (this.event = event)
    priority && (this.priority = priority)

    /**
     * 定时任务，可以是数组
     */
    task &&
      (this.task = {
        /** 任务名 */
        name: task?.name ?? '',
        /** 任务方法名 */
        fnc: task?.fnc ?? '',
        /** 任务cron表达式 */
        cron: task?.cron ?? ''
      })

    /**
     * 命令规则
     */
    rule && (this.rule = rule)

    if (handler) {
      this.handler = handler
      this.namespace = namespace || ''
    }

  }

  /**
   * @param msg 发送的消息
   * @param quote 是否引用回复
   * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
   * @param data.at 是否at用户
   */
  reply(msg: any[] | string = '', quote = false, data = {}) {
    if (!this.e?.reply || !msg) return false
    return this.e.reply(msg, quote, data)
  }

  /**
   * @deprecated 已废弃
   */
  group_id: number
  /**
   * @deprecated 已废弃
   */
  groupId: number
  /**
   * @deprecated 已废弃
   */
  user_id: number
  /**
   * @deprecated 已废弃
   */
  userId: number

  /**
   *
   * @param isGroup
   * @returns
   */
  conKey(isGroup = false) {
    if (isGroup) {
      return `${this.name}.${this.group_id || this.groupId || this.e.group_id}`
    } else {
      return `${this.name}.${this.user_id || this.userId || this.e.user_id}`
    }
  }

  /**
   * @param type 执行方法
   * @param isGroup 是否群聊
   * @param time 操作时间
   * @param timeout 操作超时回复
   */
  setContext(
    type: string,
    isGroup = false,
    time = 120,
    timeout = '操作超时已取消'
  ) {
    const key = this.conKey(isGroup)
    if (!State[key]) State[key] = {}
    State[key][type] = this.e
    if (time)
      State[key][type][SymbolTimeout] = setTimeout(() => {
        if (State[key][type]) {
          const resolve = State[key][type][SymbolResolve]
          delete State[key][type]
          resolve ? resolve(false) : this.reply(timeout, true)
        }
      }, time * 1000)
    return State[key][type]
  }

  /**
   *
   * @param type
   * @param isGroup
   * @returns
   */
  getContext(type: string, isGroup?: boolean) {
    if (type) return State[this.conKey(isGroup)]?.[type]
    return State[this.conKey(isGroup)]
  }

  /**
   *
   * @param type
   * @param isGroup
   */
  finish(type: string, isGroup?: boolean) {
    const key = this.conKey(isGroup)
    if (State[key]?.[type]) {
      clearTimeout(State[key][type][SymbolTimeout])
      delete State[key][type]
    }
  }

  /**
   *
   * @param args
   * @returns
   */
  awaitContext(...args) {
    return new Promise(
      resolve =>
        (this.setContext('resolveContext', ...args)[SymbolResolve] = resolve)
    )
  }

  /**
   *
   * @param context
   */
  resolveContext(context) {
    this.finish('resolveContext')
    context[SymbolResolve](this.e)
  }

  /**
   * @deprecated 已废弃
   * @param plugin
   * @param tpl
   * @param data
   * @param cfg
   * @returns
   */
  async renderImg(plugin, tpl, data, cfg) {
    return Common.render(plugin, tpl, data, { ...cfg, e: this.e })
  }
}


/**
 * @deprecated 已废弃
 */
export const plugin = Plugin