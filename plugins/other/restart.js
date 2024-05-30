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
          reg: "^#开机$",
          fnc: "start"
        }
      ]
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
      priority: 10,
      rule: [
        {
          reg: "^#重启$",
          fnc: "restart",
          permission: "master"
        },
        {
          reg: "^#关机$",
          fnc: "stop",
          permission: "master"
        },
        {
          reg: "^#停(机|止)$",
          fnc: "exit",
          permission: "master"
        }
      ]
    })
    if (e) this.e = e
  }
  key = "Yz:restart"

  init() {
    Bot.once("online", () => this.restartMsg())
    this.e = {
      reply: msg => Bot.sendMasterMsg(msg),
      isMaster: true,
    }
    if (cfg.bot.restart_time)
      setTimeout(() => this.restart(), cfg.bot.restart_time*60000)

    this.task = []
    if (cfg.bot.restart_cron)
      for (const i of Array.isArray(cfg.bot.restart_cron) ? cfg.bot.restart_cron : [cfg.bot.restart_cron])
        this.task.push({
          name: "定时重启",
          cron: i,
          fnc: () => this.restart(),
        })
    if (cfg.bot.stop_cron)
      for (const i of Array.isArray(cfg.bot.stop_cron) ? cfg.bot.stop_cron : [cfg.bot.stop_cron])
        this.task.push({
          name: "定时关机",
          cron: i,
          fnc: () => this.stop(),
        })
    if (cfg.bot.start_cron)
      for (const i of Array.isArray(cfg.bot.start_cron) ? cfg.bot.start_cron : [cfg.bot.start_cron])
        this.task.push({
          name: "定时开机",
          cron: i,
          fnc: () => new Start(this.e).start(),
        })
  }

  async restartMsg() {
    let restart = await redis.get(this.key)
    if (!restart) return
    await redis.del(this.key)
    restart = JSON.parse(restart)
    if (restart.isStop)
      return this.stop(restart.time)

    const time = Bot.getTimeDiff(restart.time)
    const msg = [restart.isExit ? `开机成功，距离上次停止${time}` : `重启成功，用时${time}`]
    if (restart.msg_id)
      msg.unshift(segment.reply(restart.msg_id))

    if (restart.group_id)
      await Bot.sendGroupMsg(restart.bot_id, restart.group_id, msg)
    else if (restart.user_id)
      await Bot.sendFriendMsg(restart.bot_id, restart.user_id, msg)
    else
      await Bot.sendMasterMsg(msg)
  }

  async set(isExit) {
    if (temp.priority)
      return redis.set(this.key, JSON.stringify({
        isStop: true,
        time: temp.stop_time,
      }))
    await this.reply(`开始${isExit ? "停止" : "重启"}，本次运行时长${Bot.getTimeDiff()}`)
    return redis.set(this.key, JSON.stringify({
      isExit,
      group_id: this.e.group_id,
      user_id: this.e.user_id,
      bot_id: this.e.self_id,
      msg_id: this.e.message_id,
      time: Date.now(),
    }))
  }

  async restart() {
    await this.set()
    if (process.env.app_type === "pm2") {
      const ret = await Bot.exec("pnpm run restart")
      if (!ret.error) process.exit()
      await this.reply(`重启错误\n${ret.error}\n${ret.stdout}\n${ret.stderr}`)
      Bot.makeLog("error", ["重启错误", ret])
    } else process.exit()
  }

  async stop(time) {
    if (temp.priority) return false
    temp.priority = PluginsLoader.priority
    PluginsLoader.priority = [{ class: Start }]
    if (typeof time === "number") return temp.stop_time = time
    temp.stop_time = Date.now()
    return this.reply(`关机成功，本次运行时长${Bot.getTimeDiff(temp.start_time)}`)
  }

  async exit() {
    await this.set(true)
    if (process.env.app_type === "pm2") {
      const ret = await Bot.exec("pnpm stop")
      await this.reply(`停止错误\n${ret.error}\n${ret.stdout}\n${ret.stderr}`)
      Bot.makeLog("error", ["停止错误", ret])
    } else process.exit(1)
  }
}