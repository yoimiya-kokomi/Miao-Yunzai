import fs from "node:fs/promises"
import lodash from "lodash"
import cfg from "../config/config.js"
import plugin from "./plugin.js"
import schedule from "node-schedule"
import { segment } from "oicq"
import chokidar from "chokidar"
import moment from "moment"
import path from "node:path"
import Runtime from "./runtime.js"
import Handler from "./handler.js"

/** 全局变量 plugin */
global.plugin = plugin
global.segment = segment

/**
 * 加载插件
 */
class PluginsLoader {
  priority = []
  handler = {}
  task = []
  dir = "plugins"

  /** 命令冷却cd */
  groupCD = {}
  singleCD = {}

  /** 插件监听 */
  watcher = {}
  taskMap = new Map()
  pluginCountMap = new Map()
  eventCache = new WeakMap()
  eventMap = {
    message: ["post_type", "message_type", "sub_type"],
    notice: ["post_type", "notice_type", "sub_type"],
    request: ["post_type", "request_type", "sub_type"],
  }

  msgThrottle = {}

  /** 星铁命令前缀 */
  srReg = /^#?(\*|星铁|星轨|穹轨|星穹|崩铁|星穹铁道|崩坏星穹铁道|铁道)+/
  /** 绝区零前缀 */
  zzzReg = /^#?(%|％|绝区零|绝区)+/

  async getPlugins() {
    const files = await fs.readdir(this.dir, { withFileTypes: true })
    const ret = []
    for (const val of files) {
      if (val.isFile()) continue
      const tmp = {
        name: val.name,
        path: `../../${this.dir}/${val.name}`,
      }

      if (await Bot.fsStat(`${this.dir}/${val.name}/index.js`)) {
        tmp.path = `${tmp.path}/index.js`
        ret.push(tmp)
        continue
      }

      const apps = await fs.readdir(`${this.dir}/${val.name}`, { withFileTypes: true })
      for (const app of apps) {
        if (!app.isFile()) continue
        if (!app.name.endsWith(".js")) continue
        ret.push({
          name: `${tmp.name}/${app.name}`,
          path: `${tmp.path}/${app.name}`,
        })
        /** 监听热更新 */
        this.watch(val.name, app.name)
      }
    }
    return ret
  }

  /**
   * 监听事件加载
   * @param isRefresh 是否刷新
   */
  async load(isRefresh = false) {
    if (isRefresh) {
      const keys = new Set([
        ...this.priority.map(i => i.key),
        ...this.taskMap.keys(),
        ...this.pluginCountMap.keys(),
      ])
      for (const key of keys) await this.unloadPlugin(key)
    }
    if (this.priority.length) return

    Bot.makeLog("info", "-----------", "Plugin")
    Bot.makeLog("info", "加载插件中...", "Plugin")

    const files = await this.getPlugins()
    this.pluginCount = 0
    const packageErr = []

    await Promise.allSettled(
      files.map(async file => {
        if (
          (await Bot.sleep(
            cfg.bot.plugin_load_timeout * 1000,
            this.importPlugin(file, packageErr),
          )) === Bot.sleepTimeout
        )
          Bot.makeLog("error", `插件加载超时 ${logger.red(file.name)}`, "Plugin")
      }),
    )

    this.packageTips(packageErr)
    this.createTask()

    Bot.makeLog("info", `加载定时任务[${this.task.length}个]`, "Plugin")
    Bot.makeLog("info", `加载插件[${this.pluginCount}个]`, "Plugin")

    /** 优先级排序 */
    this.priority = lodash.orderBy(this.priority, ["priority"], ["asc"])
  }

  load_time = {}
  async importPlugin(file, packageErr) {
    const start_time = Date.now()
    let success = true
    this.pluginCountMap.set(file.name, 0)
    try {
      const module = await import(file.path)
      const app = module.apps ? { ...module.apps } : module
      const pluginArray = []
      lodash.forEach(app, p => pluginArray.push(this.loadPlugin(file, p)))
      for (const i of await Promise.allSettled(pluginArray))
        if (i?.status && i.status !== "fulfilled") {
          success = false
          Bot.makeLog("error", [`插件加载错误 ${logger.red(file.name)}`, i], "Plugin")
        }
    } catch (error) {
      success = false
      if (packageErr && error.stack.includes("Cannot find package")) {
        packageErr.push({ error, file })
      } else {
        Bot.makeLog("error", [`插件加载错误 ${logger.red(file.name)}`, error], "Plugin")
      }
    }
    this.load_time[file.name] = Date.now() - start_time
    return success
  }

  async loadPlugin(file, p) {
    if (!p?.prototype) return
    this.pluginCount++
    this.pluginCountMap.set(file.name, (this.pluginCountMap.get(file.name) ?? 0) + 1)
    /** 初始化、定时任务实例 */
    const init = new p()
    Bot.makeLog("debug", `加载插件 [${file.name}][${init.name}]`, "Plugin")
    /** 执行初始化，返回 return 则跳过加载 */
    if (init.init && (await init.init()) === "return") return
    /** 设置定时任务 */
    this.collectTask(init.task, init.name, file.name)
    /** 处理消息实例 */
    const plugin = new p()
    /** 初始化正则表达式 */
    if (plugin.rule)
      for (const i of plugin.rule) if (!(i.reg instanceof RegExp)) i.reg = new RegExp(i.reg)

    const namespace = plugin.namespace || file.name
    this.priority.push({
      plugin,
      class: p,
      key: file.name,
      name: plugin.name,
      priority: plugin.priority,
      namespace,
    })
    this.registerHandlers(plugin, namespace)
  }

  registerHandlers(plugin, namespace = plugin.namespace) {
    if (!plugin.handler) return
    lodash.forEach(plugin.handler, ({ fn, key, priority }) => {
      Handler.add({
        ns: namespace,
        key,
        self: plugin,
        priority: priority ?? plugin.priority,
        fn: plugin[fn],
      })
    })
  }

  packageTips(packageErr) {
    if (!packageErr.length) return
    Bot.makeLog("error", "--------- 插件加载错误 ---------", "Plugin")
    for (const i of packageErr) {
      const pack = i.error.stack.match(/'(.+?)'/g)[0].replace(/'/g, "")
      Bot.makeLog("error", `${logger.cyan(i.file.name)} 缺少依赖 ${logger.red(pack)}`, "Plugin")
    }
    Bot.makeLog("error", `安装插件后请 ${logger.red("pnpm i")} 安装依赖`, "Plugin")
    Bot.makeLog("error", `仍报错${logger.red("进入插件目录")} pnpm add 依赖`, "Plugin")
    Bot.makeLog("error", "--------------------------------", "Plugin")
  }

  /**
   * 处理事件
   *
   * 参数文档 https://git.trss.me/Yunzai/tree/docs
   * @param e 事件
   */
  async deal(e) {
    this.count(e, "receive", e.message)
    /** 检查黑白名单 */
    if (!this.checkBlack(e)) return
    const groupCfg = cfg.getGroup(e.self_id, e.group_id)
    /** 冷却 */
    if (!this.checkLimit(e, groupCfg)) return
    /** 处理事件 */
    this.dealEvent(e, groupCfg)
    /** 设置冷却 */
    if (e.only_reply_at) this.setLimit(e, groupCfg)
    /** 处理回复 */
    this.reply(e)
    /** 注册runtime */
    await Runtime.init(e)

    const priority = []
    for (const i of this.priority) {
      /** 判断是否启用功能，过滤事件 */
      if (
        this.checkDisable(Object.assign(i.plugin, { e }), groupCfg) &&
        this.filtEvent(e, i.plugin)
      )
        priority.push(i)
    }

    for (const i of priority) {
      /** 上下文hook */
      if (!i.plugin.getContext) continue
      const context = {
        ...i.plugin.getContext(),
        ...i.plugin.getContext(false, true),
      }
      if (!lodash.isEmpty(context)) {
        let ret
        for (const fnc in context)
          ret ||= await Object.assign(new i.class(e), { e })[fnc](context[fnc])
        if (ret === "continue") continue
        return
      }
    }

    /** 是否只关注主动at */
    if (!e.only_reply_at) return

    // 判断是否是星铁命令，若是星铁命令则标准化处理
    // e.isSr = true，且命令标准化为 #星铁 开头
    Object.defineProperty(e, "isSr", {
      get: () => e.game === "sr",
      set: v => (e.game = v ? "sr" : "gs"),
    })
    Object.defineProperty(e, "isGs", {
      get: () => e.game === "gs",
      set: v => (e.game = v ? "gs" : "sr"),
    })
    if (this.srReg.test(e.msg)) {
      e.game = "sr"
      e.msg = e.msg.replace(this.srReg, "#星铁")
    } else if (this.zzzReg.test(e.msg)) {
      e.game = "zzz"
      e.msg = e.msg.replace(this.zzzReg, "#绝区零")
    }

    /** 优先执行 accept */
    for (const i of priority)
      if (i.plugin.accept) {
        const res = await Object.assign(new i.class(e), { e }).accept(e)
        if (res === "return") return
        if (res) break
      }

    for (const i of priority) {
      if (i.plugin.rule)
        for (const v of i.plugin.rule) {
          /** 判断事件 */
          if (v.event && !this.filtEvent(e, v)) continue

          /** 正则匹配 */
          if (!v.reg.test(e.msg)) continue
          const plugin = Object.assign(new i.class(e), { e })
          e.logFnc = `${logger.blue(`[${plugin.name}(${v.fnc})]`)}`

          Bot.makeLog(
            v.log === false ? "debug" : "info",
            `${e.logText}${e.logFnc}${logger.yellow("[开始处理]")}`,
            false,
          )

          /** 判断权限 */
          if (this.filtPermission(e, v))
            try {
              const start_time = Date.now()
              const res = plugin[v.fnc] && (await plugin[v.fnc](e))
              if (res === false) continue
              Bot.makeLog(
                v.log === false ? "debug" : "mark",
                `${e.logText}${e.logFnc}${logger.green(`[完成${Bot.getTimeDiff(start_time)}]`)}`,
                false,
              )
            } catch (err) {
              Bot.makeLog("error", [`${e.logText}${e.logFnc}`, err], false)
            }
          return
        }
    }

    Bot.makeLog("debug", `${e.logText}${logger.blue(`[暂无插件处理]`)}`, false)
  }

  /** 过滤事件 */
  filtEvent(e, v) {
    if (!v.event) return false
    let cache = this.eventCache.get(v)
    if (!cache || cache.source !== v.event) {
      cache = { source: v.event, event: v.event.split(".") }
      this.eventCache.set(v, cache)
    }

    const eventMap = this.eventMap[e.post_type] || []
    const mappedEvent = cache.event.map((value, i) => (value === "*" ? value : e[eventMap[i]]))
    return v.event === mappedEvent.join(".")
  }

  /** 判断权限 */
  filtPermission(e, v) {
    if (!v.permission || e.isMaster) return true

    if (v.permission === "master") {
      e.reply("暂无权限，只有主人才能操作")
      return false
    }

    if (e.isGroup) {
      if (v.permission === "owner" && !e.member.is_owner) {
        e.reply("暂无权限，只有群主才能操作")
        return false
      }
      if (v.permission === "admin" && !e.member.is_owner && !e.member.is_admin) {
        e.reply("暂无权限，只有管理员才能操作")
        return false
      }
    }

    return true
  }

  dealText(text = "") {
    if (cfg.bot["/→#"]) text = text.replace(/^\s*\/\s*/, "#")
    return text
      .replace(/^\s*[＃井]\s*/, "#")
      .replace(/^\s*[＊※]\s*/, "*")
      .trim()
  }

  /**
   * 处理事件，加入自定义字段
   * @param e.msg 文本消息，多行会自动拼接
   * @param e.img 图片消息数组
   * @param e.atBot 是否at机器人
   * @param e.at 是否at，多个at 以最后的为准
   * @param e.file 接受到的文件
   * @param e.isPrivate 是否私聊
   * @param e.isGroup 是否群聊
   * @param e.isMaster 是否管理员
   * @param e.logText 日志用户字符串
   * @param e.logFnc  日志方法字符串
   */
  dealEvent(e, groupCfg) {
    if (e.message)
      for (const i of e.message) {
        switch (i.type) {
          case "text":
            e.msg = (e.msg || "") + this.dealText(i.text)
            break
          case "image":
            if (Array.isArray(e.img)) e.img.push(i.url)
            else e.img = [i.url]
            break
          case "at":
            if (i.qq == e.self_id) e.atBot = true
            else e.at = i.qq
            break
          case "reply":
            e.reply_id = i.id
            if (e.group?.getMsg) e.getReply = () => e.group.getMsg(e.reply_id)
            else if (e.friend?.getMsg) e.getReply = () => e.friend.getMsg(e.reply_id)
            break
          case "file":
            e.file = i
            break
          case "xml":
          case "json":
            e.msg = (e.msg || "") + (typeof i.data === "string" ? i.data : JSON.stringify(i.data))
            break
        }
      }

    e.logText = ""
    e.sender && (e.sender.card ||= e.sender.nickname)
    if (e.message_type === "private" || e.notice_type === "friend") {
      e.isPrivate = true
      e.logText = `[${e.sender?.nickname ? `${e.sender.nickname}(${e.user_id})` : e.user_id}]`

      if (!e.recall && e.message_id && e.friend?.recallMsg)
        e.recall = e.friend.recallMsg.bind(e.friend, e.message_id)
    } else if (e.message_type === "group" || e.notice_type === "group") {
      e.isGroup = true
      e.logText = `[${e.group_name ? `${e.group_name}(${e.group_id})` : e.group_id}, ${e.sender?.card ? `${e.sender.card}(${e.user_id})` : e.user_id}]`

      if (!e.recall && e.message_id && e.group?.recallMsg)
        e.recall = e.group.recallMsg.bind(e.group, e.message_id)
    }

    e.logText = `${logger.cyan(e.logText)}${logger.red(`[${lodash.truncate(e.msg || e.raw_message || [e.post_type, e.notice_type, e.sub_type].filter(i => i).join("."), { length: 100 })}]`)}`

    if (e.user_id && cfg.master[e.self_id]?.includes(String(e.user_id))) e.isMaster = true

    /** 只关注主动at msg处理 */
    if (e.msg && e.isGroup && !e.atBot) {
      groupCfg ||= cfg.getGroup(e.self_id, e.group_id)
      const alias = groupCfg.botAlias
      for (const i of Array.isArray(alias) ? alias : [alias])
        if (e.msg.startsWith(i)) {
          e.msg = e.msg.replace(i, "")
          e.hasAlias = true
          break
        }
    }

    e.only_reply_at = this.onlyReplyAt(e, groupCfg)
  }

  /** 处理回复,捕获发送失败异常 */
  reply(e) {
    if (!e.reply?.bind) return
    const reply = e.reply.bind(e)

    /**
     * @param msg 发送的消息
     * @param quote 是否引用回复
     * @param data.recallMsg 是否撤回消息，0-120秒，0不撤回
     * @param data.at 是否提及用户
     */
    e.reply = async (msg = "", quote = false, data = {}) => {
      if (!msg) return false

      let { recallMsg = 0, at = "" } = data

      if (at && e.isGroup) {
        if (at === true) at = e.user_id
        if (Array.isArray(msg)) msg.unshift(segment.at(at), "\n")
        else msg = [segment.at(at), "\n", msg]
      }

      if (quote && e.message_id) {
        if (Array.isArray(msg)) msg.unshift(segment.reply(e.message_id))
        else msg = [segment.reply(e.message_id), msg]
      }

      let res
      try {
        res = await reply(msg)
      } catch (err) {
        Bot.makeLog("error", ["发送消息错误", msg, err], e.self_id)
        res = { error: [err] }
      }

      if (recallMsg > 0 && res?.message_id) {
        if (e.group?.recallMsg)
          setTimeout(() => {
            e.group.recallMsg(res.message_id)
            if (e.message_id) e.group.recallMsg(e.message_id)
          }, recallMsg * 1000)
        else if (e.friend?.recallMsg)
          setTimeout(() => {
            e.friend.recallMsg(res.message_id)
            if (e.message_id) e.friend.recallMsg(e.message_id)
          }, recallMsg * 1000)
      }

      this.count(e, "send", msg)
      return res
    }
  }

  async count(e, type, msg) {
    const count = new Map([[`${type}:msg`, 1]])
    if (cfg.bot.msg_type_count)
      for (const i of Array.isArray(msg) ? msg : [msg]) {
        const key = `${type}:${i?.type || "text"}`
        count.set(key, (count.get(key) || 0) + 1)
      }
    await this.saveCounts(e, count)
  }

  async saveCount(e, type) {
    await this.saveCounts(e, new Map([[type, 1]]))
  }

  async saveCounts(e, count) {
    const key = []

    const now = moment()
    const day = now.format("YYYY:MM:DD")
    const month = now.format("YYYY:MM")
    const year = now.format("YYYY")
    for (const i of [day, month, year, "total"]) {
      key.push(`total:${i}`)
      if (e.self_id) key.push(`bot:${e.self_id}:${i}`)
      if (e.user_id) key.push(`user:${e.user_id}:${i}`)
      if (e.group_id) key.push(`group:${e.group_id}:${i}`)
    }

    const multi = redis.multi()
    for (const [type, value] of count)
      for (const i of key) multi.incrBy(`Yz:count:${type}:${i}`, value)
    await multi.exec()
  }

  /** 收集定时任务 */
  collectTask(task, name, key) {
    const tasks = key && (this.taskMap.get(key) ?? new Set())
    if (key) this.taskMap.set(key, tasks)
    for (const i of Array.isArray(task) ? task : [task])
      if (i.cron && i.fnc) {
        i.name ??= name
        this.task.push(i)
        tasks?.add(i)
      }
  }

  async startTask(name, i) {
    try {
      const start_time = Date.now()
      Bot.makeLog(
        i.log === false ? "debug" : "mark",
        `${name}${logger.yellow("[开始处理]")}`,
        false,
      )
      await i.fnc()
      Bot.makeLog(
        i.log === false ? "debug" : "mark",
        `${name}${logger.green(`[完成${Bot.getTimeDiff(start_time)}]`)}`,
        false,
      )
    } catch (err) {
      Bot.makeLog("error", [name, err], false)
    }
  }

  /** 创建定时任务 */
  createTask() {
    const created = new Set()
    for (const i of this.task) {
      if (i.job?.cancel) i.job.cancel()
      const name = `${logger.blue(`[${i.name}(${i.cron})]`)}`
      if (created.has(name)) {
        Bot.makeLog("warn", `重复定时任务 ${name} 已跳过`, "Task")
        continue
      }
      created.add(name)
      Bot.makeLog("debug", `加载定时任务 ${name}`, "Task")
      i.job = schedule.scheduleJob(
        i.cron.split(/\s+/).slice(0, 6).join(" "),
        this.startTask.bind(this, name, i),
      )
    }
  }

  /** 检查命令冷却cd */
  checkLimit(e, config) {
    /** 禁言中 */
    if (
      e.group &&
      (e.group.mute_left > 0 || (e.group.all_muted && !e.group.is_admin && !e.group.is_owner))
    )
      return false
    if (!e.message || e.isPrivate) return true

    config ||= cfg.getGroup(e.self_id, e.group_id)

    if (config.groupCD && this.groupCD[e.group_id]) return false

    if (config.singleCD && this.singleCD[`${e.group_id}.${e.user_id}`]) return false

    const msgId = `${e.self_id}:${e.user_id}:${e.raw_message}`
    if (this.msgThrottle[msgId]) return false

    this.msgThrottle[msgId] = true
    setTimeout(() => delete this.msgThrottle[msgId], 1000)

    return true
  }

  /** 设置冷却cd */
  setLimit(e, config) {
    if (e.isPrivate) return
    config ||= cfg.getGroup(e.self_id, e.group_id)

    if (config.groupCD) {
      this.groupCD[e.group_id] = true
      setTimeout(() => delete this.groupCD[e.group_id], config.groupCD)
    }
    if (config.singleCD) {
      const key = `${e.group_id}.${e.user_id}`
      this.singleCD[key] = true
      setTimeout(() => delete this.singleCD[key], config.singleCD)
    }
  }

  /** 是否只关注主动at */
  onlyReplyAt(e, groupCfg) {
    if (!e.message || e.isPrivate) return true

    groupCfg ||= cfg.getGroup(e.self_id, e.group_id)

    /** 模式0，未开启前缀 */
    if (groupCfg.onlyReplyAt === 0 || !groupCfg.botAlias) return true

    /** 模式2，非主人开启 */
    if (groupCfg.onlyReplyAt === 2 && e.isMaster) return true

    /** at机器人 */
    if (e.atBot) return true

    /** 消息带前缀 */
    if (e.hasAlias) return true

    return false
  }

  /** 判断黑白名单 */
  checkBlack(e) {
    const other = cfg.getOther()

    /** 黑名单用户 */
    if (other.blackUser?.length && other.blackUser.includes(Number(e.user_id) || String(e.user_id)))
      return false
    /** 白名单用户 */
    if (
      other.whiteUser?.length &&
      !other.whiteUser.includes(Number(e.user_id) || String(e.user_id))
    )
      return false

    if (e.group_id) {
      /** 黑名单群 */
      if (
        other.blackGroup?.length &&
        other.blackGroup.includes(Number(e.group_id) || String(e.group_id))
      )
        return false
      /** 白名单群 */
      if (
        other.whiteGroup?.length &&
        !other.whiteGroup.includes(Number(e.group_id) || String(e.group_id))
      )
        return false
    }

    return true
  }

  /** 判断是否启用功能 */
  checkDisable(p, groupCfg) {
    groupCfg ||= cfg.getGroup(p.e.self_id, p.e.group_id)
    if (groupCfg.disable?.length && groupCfg.disable.includes(p.name)) return false
    if (groupCfg.enable?.length && !groupCfg.enable.includes(p.name)) return false
    return true
  }

  async unloadPlugin(key, closeWatcher = false) {
    const entries = this.priority.filter(i => i.key === key)
    const namespaces = new Set(entries.map(i => i.namespace || i.plugin.namespace || key))
    for (const ns of namespaces) Handler.del(ns)

    const tasks = this.taskMap.get(key)
    if (tasks) {
      for (const i of tasks) i.job?.cancel?.()
      this.task = this.task.filter(i => !tasks.has(i))
      this.taskMap.delete(key)
    }

    this.priority = this.priority.filter(i => i.key !== key)
    const pluginCount = this.pluginCountMap.get(key) ?? entries.length
    if (typeof this.pluginCount === "number")
      this.pluginCount = Math.max(0, this.pluginCount - pluginCount)
    this.pluginCountMap.delete(key)
    delete this.load_time[key]

    if (closeWatcher) {
      const watcherKey = key.replace("/", ".")
      const watcher = this.watcher[watcherKey]
      if (watcher) {
        watcher.changeHandler?.cancel?.()
        watcher.unlinkHandler?.cancel?.()
        await Promise.resolve(watcher.close?.()).catch(() => {})
        delete this.watcher[watcherKey]
      }
    }
  }

  async changePlugin(key) {
    const oldPriority = this.priority.filter(i => i.key === key)
    const oldTasks = this.taskMap.get(key)
    const oldPluginFileCount = this.pluginCountMap.get(key)
    const oldLoadTime = this.load_time[key]
    const oldPluginCount = this.pluginCount
    try {
      await this.unloadPlugin(key)
      const success = await this.importPlugin({
        name: key,
        path: `../../${this.dir}/${key}?${moment().format("x")}`,
      })
      if (!success) {
        await this.unloadPlugin(key)
        this.priority.push(...oldPriority)
        if (oldTasks) {
          const tasks = [...oldTasks]
          this.task.push(...tasks)
          this.taskMap.set(key, new Set(tasks))
        }
        if (oldLoadTime !== undefined) this.load_time[key] = oldLoadTime
        this.pluginCount = oldPluginCount
        if (oldPluginFileCount !== undefined) this.pluginCountMap.set(key, oldPluginFileCount)
        for (const i of oldPriority) this.registerHandlers(i.plugin, i.namespace || key)
      }
      this.priority = lodash.orderBy(this.priority, ["priority"], ["asc"])
      this.createTask()
    } catch (err) {
      Bot.makeLog("error", [`插件加载错误 ${logger.red(key)}`, err], "Plugin")
    }
  }

  /** 监听热更新 */
  watch(dirName, appName) {
    this.watchDir(dirName)
    if (this.watcher[`${dirName}.${appName}`]) return

    const file = `./${this.dir}/${dirName}/${appName}`
    const watcher = chokidar.watch(file)
    const key = `${dirName}/${appName}`

    /** 监听修改 */
    const changeHandler = lodash.debounce(() => {
      Bot.makeLog("mark", `[修改插件][${dirName}][${appName}]`, "Plugin")
      this.changePlugin(key)
    }, 5000)
    watcher.on("change", changeHandler)

    /** 监听删除 */
    const unlinkHandler = lodash.debounce(async () => {
      Bot.makeLog("mark", `[卸载插件][${dirName}][${appName}]`, "Plugin")
      await this.unloadPlugin(key, true)
    }, 5000)
    watcher.on("unlink", unlinkHandler)
    watcher.changeHandler = changeHandler
    watcher.unlinkHandler = unlinkHandler
    this.watcher[`${dirName}.${appName}`] = watcher
  }

  /** 监听文件夹更新 */
  watchDir(dirName) {
    if (this.watcher[dirName]) return
    const watcher = chokidar.watch(`./${this.dir}/${dirName}/`)
    /** 热更新 */
    Bot.once("online", () => {
      /** 新增文件 */
      const pendingPaths = new Set()
      const addHandler = lodash.debounce(async () => {
        const paths = [...pendingPaths]
        pendingPaths.clear()
        for (const PluPath of paths) {
          const appName = path.basename(PluPath)
          Bot.makeLog("mark", `[新增插件][${dirName}][${appName}]`, "Plugin")
          const key = `${dirName}/${appName}`
          await this.importPlugin({
            name: key,
            path: `../../${this.dir}/${key}?${moment().format("X")}`,
          })
          /** 优先级排序 */
          this.priority = lodash.orderBy(this.priority, ["priority"], ["asc"])
          this.createTask()
          this.watch(dirName, appName)
        }
      }, 5000)
      watcher.on("add", PluPath => {
        if (!PluPath.endsWith(".js")) return
        pendingPaths.add(PluPath)
        addHandler()
      })
    })
    this.watcher[dirName] = watcher
  }
}
export default new PluginsLoader()
