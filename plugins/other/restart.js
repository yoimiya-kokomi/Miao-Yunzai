import cfg from "../../lib/config/config.js"
import { spawn } from "child_process"

export class Restart extends plugin {
  constructor(e = "") {
    super({
      name: "重启",
      dsc: "#重启",
      event: "message",
      priority: 10,
      rule: [
        {
          reg: "^#重启$",
          fnc: "restart",
          permission: "master"
        },
        {
          reg: "^#(停|关)(机|止)$",
          fnc: "stop",
          permission: "master"
        }
      ]
    })

    if (e) this.e = e
    this.key = "Yz:restart"
  }

  init() {
    Bot.once("online", () => this.restartMsg())
    if (cfg.bot.restart_time) {
      this.e = { reply: msg => Bot.sendMasterMsg(msg) }
      setTimeout(() => this.restart(), cfg.bot.restart_time*60000)
    }
  }

  async restartMsg() {
    let restart = await redis.get(this.key)
    if (!restart) return
    restart = JSON.parse(restart)

    const time = Bot.getTimeDiff(restart.time)
    const msg = [restart.isStop ? `开机成功，距离上次关机${time}` : `重启成功，用时${time}`]
    if (restart.msg_id)
      msg.unshift(segment.reply(restart.msg_id))

    if (restart.group_id)
      await Bot.sendGroupMsg(restart.bot_id, restart.group_id, msg)
    else if (restart.user_id)
      await Bot.sendFriendMsg(restart.bot_id, restart.user_id, msg)
    else
      await Bot.sendMasterMsg(msg)

    return redis.del(this.key)
  }

  async set(isStop) {
    await this.e.reply(`开始${isStop ? "关机" : "重启"}，本次运行时长：${Bot.getTimeDiff()}`)
    return redis.set(this.key, JSON.stringify({
      isStop,
      group_id: this.e.group_id,
      user_id: this.e.user_id,
      bot_id: this.e.self_id,
      msg_id: this.e.message_id,
      time: Date.now()/1000,
    }))
  }

  async restart() {
    await this.set()
    if (process.env.app_type == "pm2") {
      const ret = await Bot.exec("pnpm run restart")
      if (!ret.error) process.exit()
      await this.e.reply(`重启错误\n${ret.error}\n${ret.stdout}\n${ret.stderr}`)
      Bot.makeLog("error", ["重启错误", ret])
    } else process.exit()
  }

  async stop() {
    await this.set(true)
    if (process.env.app_type == "pm2") {
      const ret = await Bot.exec("pnpm stop")
      await this.e.reply(`关机错误\n${ret.error}\n${ret.stdout}\n${ret.stderr}`)
      Bot.makeLog("error", ["关机错误", ret])
    } else process.exit(1)
  }
}