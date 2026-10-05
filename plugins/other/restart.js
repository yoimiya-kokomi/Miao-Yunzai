import cfg from "../../lib/config/config.js"
import { spawn } from "child_process"
import PluginsLoader from "../../lib/plugins/loader.js"

const temp = {}
class Start extends plugin {
  constructor(e) {
    super({
      name: "开机",
      dsc: "#开机",
      event: "message",
      rule: [
        {
          reg: /^#开机$/,
          fnc: "start",
        },
      ],
    })
    if (e) this.e = e
  }

  async start() {
    if (!this.e.isMaster || !temp.priority) return false
    PluginsLoader.priority = temp.priority
    delete temp.priority
    temp.start_time = Date.now()
    return this.reply(`开机成功，距离上次关机${Bot.getTimeDiff(temp.stop_time)}`)
  }
}

export class Restart extends plugin {
  constructor(e) {
    super({
      name: "进程管理",
      dsc: "#重启 #关机 #停止",
      event: "message",
      priority: -Infinity,
      rule: [
        {
          reg: "^#重启$",
          fnc: "restart",
          permission: "master",
        },
        {
          reg: "^#关机$",
          fnc: "stop",
          permission: "master",
        },
        {
          reg: "^#停(机|止)$",
          fnc: "exit",
          permission: "master",
        },
      ],
    })
    if (e) this.e = e
  }
  key = "Yz:restart"

  init() {
    this.addCleanup(this.stopInitialization, this.restoreInitialization)
    this.restartOnlinePending = true
    this.restartOnlineHandler = (...args) => {
      this.restartOnlinePending = false
      return this.restartMsg(...args)
    }
    Bot.once("online", this.restartOnlineHandler)
    this.e = {
      reply: msg => Bot.sendMasterMsg(msg),
      isMaster: true,
    }
    if (cfg.bot.restart_time) this.scheduleRestart(cfg.bot.restart_time * 60000)

    this.task = []
    if (cfg.bot.restart_cron)
      for (const i of Array.isArray(cfg.bot.restart_cron)
        ? cfg.bot.restart_cron
        : [cfg.bot.restart_cron])
        this.task.push({
          name: "定时重启",
          cron: i,
          fnc: this.runAutoRestart.bind(this),
        })
    if (cfg.bot.stop_cron)
      for (const i of Array.isArray(cfg.bot.stop_cron) ? cfg.bot.stop_cron : [cfg.bot.stop_cron])
        this.task.push({
          name: "定时关机",
          cron: i,
          fnc: this.stop.bind(this),
        })
    if (cfg.bot.start_cron)
      for (const i of Array.isArray(cfg.bot.start_cron) ? cfg.bot.start_cron : [cfg.bot.start_cron])
        this.task.push({
          name: "定时开机",
          cron: i,
          fnc: () => new Start(this.e).start(),
        })
  }

  runAutoRestart() {
    if (this.restartStopped) return Promise.resolve(false)
    const pending = (this.restartOperations ??= new Set())
    const operation = Promise.resolve()
      .then(() => (this.restartStopped ? false : this.restart()))
      .finally(() => pending.delete(operation))
    pending.add(operation)
    return operation
  }

  scheduleRestart(delay) {
    this.restartDeadline = Date.now() + delay
    const timer = setTimeout(() => {
      if (this.restartTimer !== timer) return
      this.restartTimer = null
      return this.runAutoRestart()
    }, delay)
    this.restartTimer = timer
  }

  stopInitialization() {
    this.restartStopped = true
    this.restartRemaining = this.restartTimer
      ? Math.max(0, this.restartDeadline - Date.now())
      : null
    clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.restartOnlineRestore = this.restartOnlinePending
    this.restartOnlinePending = false
    Bot.off("online", this.restartOnlineHandler)
    return Promise.allSettled(this.restartOperations ?? [])
  }

  restoreInitialization() {
    this.restartStopped = false
    if (this.restartOnlineRestore) {
      this.restartOnlinePending = true
      Bot.once("online", this.restartOnlineHandler)
    }
    if (this.restartRemaining !== null) this.scheduleRestart(this.restartRemaining)
  }

  async restartMsg() {
    let restart = await redis.get(this.key)
    if (!restart) return
    await redis.del(this.key)
    restart = JSON.parse(restart)
    if (restart.isStop) return this.stop(restart.time)

    const time = Bot.getTimeDiff(restart.time)
    const msg = [restart.isExit ? `开机成功，距离上次停止${time}` : `重启成功，用时${time}`]

    if (restart.group_id) await Bot.sendGroupMsg(restart.bot_id, restart.group_id, msg)
    else if (restart.user_id) await Bot.sendFriendMsg(restart.bot_id, restart.user_id, msg)
    else await Bot.sendMasterMsg(msg)
  }

  async set(isExit) {
    if (temp.priority)
      return redis.set(
        this.key,
        JSON.stringify({
          isStop: true,
          time: temp.stop_time,
        }),
      )
    await this.reply(`开始${isExit ? "停止" : "重启"}，本次运行时长${Bot.getTimeDiff()}`)
    return redis.set(
      this.key,
      JSON.stringify({
        isExit,
        group_id: this.e.group_id,
        user_id: this.e.user_id,
        bot_id: this.e.self_id,
        time: Date.now(),
      }),
    )
  }

  async restart() {
    await this.set()
    const ret = await Bot.restart()
    await this.reply(`重启错误\n${Bot.String(ret)}}`)
  }

  async stop(time) {
    if (temp.priority) return false
    temp.priority = PluginsLoader.priority
    PluginsLoader.priority = [{ plugin: new Start(), class: Start }]
    if (typeof time === "number") return (temp.stop_time = time)
    temp.stop_time = Date.now()
    return this.reply(`关机成功，本次运行时长${Bot.getTimeDiff(temp.start_time)}`)
  }

  async exit() {
    await this.set(true)
    const ret = await Bot.exit()
    await this.reply(`停止错误\n${Bot.String(ret)}`)
  }
}
