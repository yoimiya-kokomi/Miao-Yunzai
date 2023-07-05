import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import path from "node:path"
import fs from "node:fs"

Bot.adapter.push(new class GSUIDCoreAdapter {
  constructor() {
    this.id = "GSUIDCore"
    this.name = "早柚核心"
    this.path = "GSUIDCore"
  }

  toStr(data) {
    switch (typeof data) {
      case "string":
        return data
      case "number":
        return String(data)
      case "object":
        if (Buffer.isBuffer(data))
          return Buffer.from(data, "utf8").toString()
        else
          return JSON.stringify(data)
    }
    return data
  }

  makeLog(msg) {
    return this.toStr(msg).replace(/("type":"(image|file)","data":").*?(")/g, "$1...$3")
  }

  async makeBase64(file) {
    if (file.match(/^base64:\/\//))
      return file.replace(/^base64:\/\//, "")
    else if (file.match(/^https?:\/\//))
      return Buffer.from(await (await fetch(file)).arrayBuffer()).toString("base64")
    return file
  }

  async makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", data: { text: i }}
      else if (!i.data)
        i = { type: i.type, data: { ...i, type: undefined }}
      if (i.data.file)
        i.data = await this.makeBase64(i.data.file)

      switch (i.type) {
        case "text":
          i.data = i.data.text
          break
        case "image":
          break
        case "file":
          break
        case "at":
          i.data = i.data.qq
          break
        case "reply":
          i.data = i.data.id
          break
        case "record":
          i.type = "file"
          break
        case "video":
          i.type = "file"
          break
        case "node":
          for (const n in i.data)
            i.data[n] = await this.makeMsg(i.data[n])
        default:
          i = { type: "text", data: JSON.stringify(i) }
      }
      msgs.push(i)
    }
    return msgs
  }

  async sendFriendMsg(data, msg) {
    const content = await this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${this.makeLog(content)}`)
    return data.bot.send(JSON.stringify({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: "direct",
      target_id: data.user_id,
      content,
    }))
  }

  async sendGroupMsg(data, msg) {
    data.group_id = data.group_id.split("-")
    const content = await this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${this.makeLog(content)}`)
    return data.bot.send(JSON.stringify({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: data.group_id[0],
      target_id: data.group_id[1],
      content,
    }))
  }

  pickFriend(id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      user_id: user_id.replace(/^gc_/, ""),
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
      recallMsg: () => false,
      makeForwardMsg: Bot.makeForwardMsg,
      sendForwardMsg: msg => Bot.sendForwardMsg(msg => this.sendFriendMsg(i, msg), msg),
    }
  }

  pickMember(id, group_id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id.replace(/^gc_/, ""),
      user_id: user_id.replace(/^gc_/, ""),
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
      group_id: group_id.replace(/^gc_/, ""),
    }
    return {
      ...i,
      sendMsg: msg => this.sendGroupMsg(i, msg),
      recallMsg: message_id => this.recallMsg(i, message_id => i.bot.API.message.delete(message_id), message_id),
      makeForwardMsg: Bot.makeForwardMsg,
      sendForwardMsg: msg => Bot.sendForwardMsg(msg => this.sendGroupMsg(i, msg), msg),
      pickMember: user_id => this.pickMember(id, group_id, user_id),
    }
  }

  makeBot(data, send) {
    Bot[data.self_id] = {
      adapter: this,
      send,
      uin: data.self_id,
      bot_id: data.bot_id,
      bot_self_id: data.bot_self_id,
      stat: { start_time: Date.now()/1000 },
      version: {
        id: this.id,
        name: this.name,
      },
      pickFriend: user_id => this.pickFriend(data.self_id, user_id),
      pickMember: (group_id, user_id) => this.pickMember(data.self_id, group_id, user_id),
      pickGroup: group_id => this.pickGroup(data.self_id, group_id),
      fl: new Map(),
      gl: new Map(),
    }
    Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend

    logger.mark(`${logger.blue(`[${data.self_id}]`)} ${this.name}(${this.id}) 已连接`)
    Bot.emit(`connect.${data.self_id}`, Bot[data.self_id])
    Bot.emit(`connect`, Bot[data.self_id])
  }

  message(data, ws) {
    try {
      data = JSON.parse(data)
    } catch (err) {
      return logger.error(`解码数据失败：${logger.red(err)}`)
    }

    data.self_id = `gc_${data.bot_self_id}`
    if (Bot[data.self_id])
      Bot[data.self_id].send = ws.send
    else
      this.makeBot(data, ws.send)
    data.bot = Bot[data.self_id]

    data.post_type = "message"
    data.message_id = data.msg_id
    data.user_id = `gc_${data.user_id}`
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
      data.friend = data.bot.pickFriend(data.user_id)
    } else {
      data.message_type = "group"
      data.group_id = `gc_${data.user_type}-${data.group_id}`
      if (!data.bot.gl.has(data.group_id))
        data.bot.gl.set(data.group_id, { group_id: data.group_id })
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.user_id}] ${data.raw_message}`)
      data.friend = data.bot.pickFriend(data.user_id)
      data.group = data.bot.pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
    }
    console.log(data)
    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  load() {
    Bot.wss[this.path] = new WebSocketServer({ noServer: true })
    Bot.wss[this.path].on("connection", ws => {
      ws.on("error", logger.error)
      ws.on("message", data => this.message(data, ws))
    })
    return true
  }
})