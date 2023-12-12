import { randomUUID } from "crypto"
import path from "node:path"
import fs from "node:fs"

Bot.adapter.push(new class GSUIDCoreAdapter {
  constructor() {
    this.id = "GSUIDCore"
    this.name = "早柚核心"
    this.path = this.id
  }

  makeLog(msg) {
    return Bot.String(msg).replace(/base64:\/\/.*?"/g, "base64://...\"")
  }

  makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", text: i }
      if (Buffer.isBuffer(i.file))
        i.file = `base64://${i.file.toString("base64")}`

      switch (i.type) {
        case "text":
          i = { type: "text", data: i.text }
          break
        case "image":
          i = { type: "image", data: i.file }
          break
        case "record":
          i = { type: "file", data: i.file }
          break
        case "video":
          i = { type: "file", data: i.file }
          break
        case "file":
          i = { type: "file", data: i.file }
          break
        case "at":
          i = { type: "at", data: i.qq }
          break
        case "reply":
          i = { type: "reply", data: i.id }
          break
        case "node": {
          const array = []
          for (const { message } of i.data)
            array.push(...this.makeMsg(message))
          i.data = array
          break
        } default:
          i = { type: "text", data: JSON.stringify(i) }
      }
      msgs.push(i)
    }
    return msgs
  }

  sendFriendMsg(data, msg) {
    const content = this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友消息：${this.makeLog(content)}`)
    data.bot.sendApi({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: "direct",
      target_id: data.user_id,
      content,
    })
    return { message_id: Date.now() }
  }

  sendGroupMsg(data, msg) {
    const target = data.group_id.split("-")
    const content = this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群消息：${this.makeLog(content)}`)
    data.bot.sendApi({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: target[0],
      target_id: target[1],
      content,
    })
    return { message_id: Date.now() }
  }

  pickFriend(id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      user_id: user_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
    }
  }

  pickMember(id, group_id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id,
      user_id: user_id,
    }
    return {
      ...this.pickFriend(id, user_id),
      ...i,
    }
  }

  pickGroup(id, group_id) {
    const i = {
      ...Bot[id].gl.get(group_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendGroupMsg(i, msg),
      pickMember: user_id => this.pickMember(id, group_id, user_id),
    }
  }

  makeBot(data, ws) {
    Bot[data.self_id] = {
      adapter: this,
      ws: ws,
      get sendApi() { return this.ws.sendMsg },
      uin: data.self_id,
      bot_id: data.bot_id,
      bot_self_id: data.bot_self_id,
      stat: { start_time: Date.now()/1000 },
      version: {
        id: this.id,
        name: this.name,
      },
      pickFriend: user_id => this.pickFriend(data.self_id, user_id),
      get pickUser() { return this.pickFriend },
      pickMember: (group_id, user_id) => this.pickMember(data.self_id, group_id, user_id),
      pickGroup: group_id => this.pickGroup(data.self_id, group_id),
      fl: new Map,
      gl: new Map,
      gml: new Map,
    }

    logger.mark(`${logger.blue(`[${data.self_id}]`)} ${this.name}(${this.id}) 已连接`)
    Bot.em(`connect.${data.self_id}`, data)
  }

  message(data, ws) {
    try {
      const raw = Bot.String(data)
      data = JSON.parse(data)
      data.raw = raw
    } catch (err) {
      return logger.error(`解码数据失败：${logger.red(err)}`)
    }

    data.self_id = data.bot_self_id
    if (Bot[data.self_id]) {
      data.bot = Bot[data.self_id]
      data.bot.ws = ws
    } else {
      this.makeBot(data, ws)
    }

    data.post_type = "message"
    data.message_id = data.msg_id
    data.user_id = data.user_id
    data.sender = {
      user_id: data.user_id,
      user_pm: data.user_pm,
    }
    if (!data.bot.fl.has(data.user_id))
      data.bot.fl.set(data.user_id, data.sender)

    data.message = []
    data.raw_message = ""
    for (const i of data.content) {
      switch (i.type) {
        case "text":
          data.message.push({ type: "text", text: i.data })
          data.raw_message += i.data
          break
        case "image":
          data.message.push({ type: "image", url: i.data })
          data.raw_message += `[图片：${i.data}]`
          break
        case "file":
          data.message.push({ type: "file", url: i.data })
          data.raw_message += `[文件：${i.data}]`
          break
        case "at":
          data.message.push({ type: "at", qq: i.data })
          data.raw_message += `[提及：${i.data}]`
          break
        case "reply":
          data.message.push({ type: "reply", id: i.data })
          data.raw_message += `[回复：${i.data}]`
          break
        case "node":
          data.message.push({ type: "node", data: i.data })
          data.raw_message += `[合并转发：${JSON.stringify(i.data)}]`
          break
        default:
          data.message.push(i)
          data.raw_message += JSON.stringify(i)
      }
    }

    if (data.user_type == "direct") {
      data.message_type = "private"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.user_id}] ${data.raw_message}`)
    } else {
      data.message_type = "group"
      data.group_id = `${data.user_type}-${data.group_id}`
      if (!data.bot.gl.has(data.group_id))
        data.bot.gl.set(data.group_id, { group_id: data.group_id })
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.user_id}] ${data.raw_message}`)
    }

    Bot.em(`${data.post_type}.${data.message_type}`, data)
  }

  load() {
    if (!Array.isArray(Bot.wsf[this.path]))
      Bot.wsf[this.path] = []
    Bot.wsf[this.path].push((ws, ...args) =>
      ws.on("message", data => this.message(data, ws, ...args))
    )
  }
})