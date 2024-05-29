import { Common } from "#miao"

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
    task = { fnc: "", cron: "" },
    rule = []
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
    this.task = {
      /** 任务名 */
      name: "",
      /** 任务方法名 */
      fnc: task.fnc || "",
      /** 任务cron表达式 */
      cron: task.cron || ""
    }
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
  setContext(type, isGroup, time = 120, timeout = "操作超时已取消") {
    const key = this.conKey(isGroup)
    if (!stateArr[key]) stateArr[key] = {}
    stateArr[key][type] = this.e
    if (time) stateArr[key][type][SymbolTimeout] = setTimeout(() => {
      if (stateArr[key][type]) {
        const resolve = stateArr[key][type][SymbolResolve]
        delete stateArr[key][type]
        resolve ? resolve(false) : this.reply(timeout, true)
      }
    }, time * 1000)
    return stateArr[key][type]
  }

  getContext(type, isGroup) {
    if (type) return stateArr[this.conKey(isGroup)]?.[type]
    return stateArr[this.conKey(isGroup)]
  }

  finish(type, isGroup) {
    const key = this.conKey(isGroup)
    if (stateArr[key]?.[type]) {
      clearTimeout(stateArr[key][type][SymbolTimeout])
      delete stateArr[key][type]
    }
  }

  awaitContext(...args) {
    return new Promise(resolve => this.setContext("resolveContext", ...args)[SymbolResolve] = resolve)
  }

  resolveContext(context) {
    this.finish("resolveContext")
    context[SymbolResolve](this.e)
  }

  async renderImg(plugin, tpl, data, cfg) {
    return Common.render(plugin, tpl, data, { ...cfg, e: this.e })
  }
}