let Common
try {
  Common = (await import("#miao")).Common
} catch {}

const stateArr = {}
const SymbolTimeout = Symbol("Timeout")
const SymbolResolve = Symbol("Resolve")

export default class plugin {
  /**
   * @param name 插件名称
   * @param dsc 插件描述
   * @param handler handler配置
   * @param handler.key handler支持的事件key
   * @param handler.fn handler的处理func
   * @param namespace namespace，设置handler时建议设置
   * @param event 执行事件，默认message
   * @param priority 优先级，数字越小优先级越高
   * @param rule
   * @param rule.reg 命令正则
   * @param rule.fnc 命令执行方法
   * @param rule.event 执行事件，默认message
   * @param rule.log  false时不显示执行日志
   * @param rule.permission 权限 master,owner,admin,all
   * @param task
   * @param task.name 定时任务名称
   * @param task.cron 定时任务cron表达式
   * @param task.fnc 定时任务方法名
   * @param task.log  false时不显示执行日志
   */
  constructor({
    name = "your-plugin",
    dsc = "无",
    handler,
    namespace,
    event = "message",
    priority = 5000,
    task = { name: "", fnc: "", cron: "" },
    rule = [],
  }) {
    /** 插件名称 */
    this.name = name
    /** 插件描述 */
    this.dsc = dsc
    /** 监听事件，默认message https://oicqjs.github.io/oicq/#events */
    this.event = event
    /** 优先级 */
    this.priority = priority
    /** 定时任务，可以是数组 */
    this.task = task
    /** 命令规则 */
    this.rule = rule

    if (handler) {
      this.handler = handler
      this.namespace = namespace || ""
    }
  }

  /**
   * @param msg 发送的消息
   * @param quote 是否引用回复
   * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
   * @param data.at 是否at用户
   */
  reply(msg = "", quote = false, data = {}) {
    if (!this.e?.reply || !msg) return false
    return this.e.reply(msg, quote, data)
  }

  conKey(isGroup = false) {
    return `${this.name}.${this.self_id || this.e.self_id}.${isGroup ? this.group_id || this.e.group_id : this.user_id || this.e.user_id}`
  }

  /**
   * @param type 执行方法
   * @param isGroup 是否群聊
   * @param time 操作时间
   * @param timeout 操作超时回复
   */
  setContext(type, isGroup, time = 120, timeout = "操作超时已取消") {
    const key = this.conKey(isGroup)
    stateArr[key] ??= {}
    const oldContext = stateArr[key][type]
    if (oldContext) {
      clearTimeout(oldContext[SymbolTimeout])
      oldContext[SymbolResolve]?.(false)
    }

    const context = this.e
    stateArr[key][type] = context
    if (time)
      context[SymbolTimeout] = setTimeout(() => {
        if (stateArr[key]?.[type] !== context) return
        const resolve = context[SymbolResolve]
        delete stateArr[key][type]
        if (!Object.keys(stateArr[key]).length) delete stateArr[key]
        resolve ? resolve(false) : this.reply(timeout, true)
      }, time * 1000)
    return context
  }

  getContext(type, isGroup) {
    if (type) return stateArr[this.conKey(isGroup)]?.[type]
    return stateArr[this.conKey(isGroup)]
  }

  finish(type, isGroup) {
    const key = this.conKey(isGroup)
    const context = stateArr[key]?.[type]
    if (context) {
      clearTimeout(context[SymbolTimeout])
      delete stateArr[key][type]
      if (!Object.keys(stateArr[key]).length) delete stateArr[key]
    }
  }

  awaitContext(...args) {
    return new Promise(
      resolve => (this.setContext("resolveContext", ...args)[SymbolResolve] = resolve),
    )
  }

  resolveContext(context) {
    for (const isGroup of [false, true])
      if (this.getContext("resolveContext", isGroup) === context)
        this.finish("resolveContext", isGroup)
    context?.[SymbolResolve]?.(this.e)
  }

  async renderImg(plugin, tpl, data, cfg) {
    return Common.render(plugin, tpl, data, { ...cfg, e: this.e })
  }
}
