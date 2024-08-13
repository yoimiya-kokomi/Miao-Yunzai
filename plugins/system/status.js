import cfg from "../../lib/config/config.js"
import moment from "moment"

export class status extends plugin {
  constructor() {
    super({
      name: "状态统计",
      dsc: "#状态",
      event: "message",
      priority: -Infinity,
      rule: [
        {
          reg: "^#(状态|统计)",
          fnc: "status",
        }
      ]
    })
  }

  async status() {
    if (!this.e.isMaster)
      return this.reply(await this.getCount({
        "用户": this.e.user_id,
        "群": this.e.group_id,
      }))

    const msg =
      `—— TRSS Yunzai v${cfg.package.version} ——\n`+
      `运行时间：${Bot.getTimeDiff()}\n`+
      `内存使用：${(process.memoryUsage().rss/1024/1024).toFixed(2)}MB\n`+
      `系统版本：${process.platform} ${process.arch} ${process.version}`+
      this.botTime() + await this.count()

    return this.reply(Bot.makeForwardArray(msg))
  }

  botTime() {
    let msg = "\n\n账号在线时长"
    for (const i of Bot.uin)
      if (Bot[i]?.stat?.start_time)
        msg += `\n${Bot.getTimeDiff(Bot[i].stat.start_time*1000)} ${i}`
    return msg
  }

  count() {
    const cmd = {
      msg: this.e.msg.replace(/^#(状态|统计)/, "").trim().split(" ")
    }
    let key = ""
    for (const i of cmd.msg) if (key) {
      cmd[key] = i
      key = ""
    } else {
      key = i
    }
    return this.getCount(cmd)
  }

  async getCount(cmd) {
    const date = []
    if (cmd["日期"]) {
      cmd["日期"] = cmd["日期"].replace(/[^\d]/g,"")
      switch (cmd["日期"].length) {
        case 8:
          date.push([
            cmd["日期"].slice(0, 4),
            cmd["日期"].slice(4, 6),
            cmd["日期"].slice(6, 8),
          ])
          break
        case 4:
          date.push([
            moment().format("YYYY"),
            cmd["日期"].slice(0, 2),
            cmd["日期"].slice(2, 4),
          ])
          break
        case 2:
          date.push([
            moment().format("YYYY"),
            moment().format("MM"),
            cmd["日期"],
          ])
          break
        default:
          this.reply(`日期格式错误：${cmd["日期"]}`)
          return ""
      }
    } else {
      const d = moment()
      for (let i = 0; i < 3; i++) {
        date.push(d.format("YYYY MM DD").split(" "))
        d.add(-86400000)
      }
      date.push(
        [d.format("YYYY"), d.format("MM")],
        [d.format("YYYY")],
        ["total"],
      )
    }

    let msg = "消息统计"
    if (cmd["消息"]) {
      msg = `${cmd["消息"]} ${msg}`
    } else {
      cmd["消息"] = "msg"
    }

    const array = []
    if (cmd["机器人"])
      array.push({ text: "机器人", key: `bot`, id: cmd["机器人"] })
    if (cmd["用户"])
      array.push({ text: "用户", key: `user`, id: cmd["用户"] })
    if (cmd["群"])
      array.push({ text: "群", key: `group`, id: cmd["群"] })
    if (!array.length) {
      array.push(
        { text: msg, key: "total" },
        { type: "keys", text: "用户量", key: "user:*" },
        { type: "keys", text: "群量", key: "group:*" },
      )
      msg = ""
      if (this.e.self_id)
        array.push({ text: "机器人", key: `bot`, id: this.e.self_id })
      if (this.e.user_id)
        array.push({ text: "用户", key: `user`, id: this.e.user_id })
      if (this.e.group_id)
        array.push({ text: "群", key: `group`, id: this.e.group_id })
    }

    for (const i of array) {
      if (i.id) {
        i.text += ` ${i.id}`
        i.key += `:${i.id}`
      }
      msg += `\n\n${i.text}`
      for (let d of date) {
        const key = `:${cmd["消息"]}:${i.key}:${d.join(":")}`
        d = d.join("-")
        if (d == "total")
          d = `总计 -------`
        else
          d = `${d} ${"-".repeat(11 - d.length)}`
        const ret = await this.redis(i.type, key)
        msg += `\n${d} 收 ${ret.receive} 发 ${ret.send}`
      }
    }
    return msg
  }

  async redis(type, key) {
    const ret = {}
    for (const i of ["receive", "send"]) {
      const k = `Yz:count:${i}${key}`
      if (type == "keys")
        ret[i] = await this.redisKeysLength(k) || 0
      else
        ret[i] = await redis.get(k) || 0
    }
    return ret
  }

  async redisKeysLength(MATCH) {
    let cursor = 0, length = 0
    do {
      const reply = await redis.scan(cursor, { MATCH, COUNT: 10000 })
      cursor = reply.cursor
      length += reply.keys.length
    } while (cursor != 0)
    return length
  }
}