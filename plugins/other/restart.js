import cfg from "../../lib/config/config.js"
import { exec } from "child_process"

export class Restart extends plugin {
  constructor (e = "") {
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
          reg: "^#(停机|关机)$",
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
      this.e = {
        logFnc: "[自动重启]" ,
        reply: msg => Bot.sendMasterMsg(msg),
      }
      setTimeout(() => this.restart(), cfg.bot.restart_time*60000)
    }
  }

  async restartMsg() {
    let restart = await redis.get(this.key)
    if (!restart) return
    restart = JSON.parse(restart)
    const time = (Date.now() - (restart.time || Date.now()))/1000
    const msg = []
    if (restart.msg_id)
      msg.push(segment.reply(restart.msg_id))
    if (restart.isStop)
      msg.push(`开机成功，距离上次关机${time}秒`)
    else
      msg.push(`重启成功，用时${time}秒`)

    if (restart.id) {
      if (restart.isGroup)
        Bot.sendGroupMsg(restart.bot_id, restart.id, msg)
      else
        Bot.sendFriendMsg(restart.bot_id, restart.id, msg)
    } else {
      Bot.sendMasterMsg(msg)
    }
    redis.del(this.key)
  }

  async restart() {
    await this.e.reply(`开始重启，本次运行时长：${Bot.getTimeDiff()}`)
    logger.mark(`${this.e.logFnc} 开始重启，本次运行时长：${Bot.getTimeDiff()}`)

    await redis.set(this.key, JSON.stringify({
      isGroup: !!this.e.isGroup,
      id: this.e.isGroup ? this.e.group_id : this.e.user_id,
      bot_id: this.e.self_id,
      msg_id: this.e.message_id,
      time: Date.now(),
    }))

    try {
      let cm = "pnpm start"
      if (process.argv[1].includes("pm2"))
        cm = "pnpm run restart"

      const ret = await this.execSync(cm)
      if (ret.error) {
        redis.del(this.key)
        await this.e.reply(`重启错误\n${ret.error}`)
        logger.error("重启错误", ret)
      } else {
        logger.mark("重启成功，运行已由前台转为后台")
        logger.mark("查看日志请用命令：pnpm run log")
        logger.mark("停止后台运行命令：pnpm stop")
        process.exit()
      }
    } catch (error) {
      redis.del(this.key)
      await this.e.reply(`重启错误\n${error}`)
      logger.error("重启错误", error)
    }
    return true
  }

  async execSync(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
  }

  async stop() {
    await redis.set(this.key, JSON.stringify({
      isStop: true,
      isGroup: !!this.e.isGroup,
      id: this.e.isGroup ? this.e.group_id : this.e.user_id,
      bot_id: this.e.self_id,
      msg_id: this.e.message_id,
      time: Date.now(),
    }))

    await this.e.reply(`关机成功，本次运行时长：${Bot.getTimeDiff()}`)

    if (!process.argv[1].includes("pm2"))
      process.exit()

    const ret = await this.execSync("pnpm stop")
    await this.e.reply(`关机错误\n${ret.error}\n${ret.stdout}\n${ret.stderr}`)
    logger.error("关机错误", ret)
  }
}