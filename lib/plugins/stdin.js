import fs from "node:fs"
import path from "node:path"
import common from "../common/common.js"

Bot.adapter.push(new class stdinAdapter {
  constructor() {
    this.id = "stdin"
    this.name = "标准输入"
    this.path = "data/stdin/"
    common.mkdirs(this.path)
  }

  async sendMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", text: i }

      let file
      if (i.file) {
        file = await Bot.fileType(i.file, i.name)
        if (Buffer.isBuffer(file.buffer)) {
          file.path = `${this.path}${file.name || Date.now()}`
          fs.writeFileSync(file.path, file.buffer)
        }
      }

      switch (i.type) {
        case "text":
          if (i.text.match("\n"))
            i.text = `\n${i.text}`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送文本：${i.text}`)
          break
        case "image":
          logger.info(`${logger.blue(`[${this.id}]`)} 发送图片：${file.url}\n文件已保存到：${logger.cyan(file.path)}`)
          break
        case "record":
          logger.info(`${logger.blue(`[${this.id}]`)} 发送音频：${file.url}\n文件已保存到：${logger.cyan(file.path)}`)
          break
        case "video":
          logger.info(`${logger.blue(`[${this.id}]`)} 发送视频：${file.url}\n文件已保存到：${logger.cyan(file.path)}`)
          break
        case "reply":
          break
        case "at":
          break
        case "node":
          Bot.sendForwardMsg(msg => this.sendMsg(msg), i.data)
          break
        default:
          i = JSON.stringify(i)
          if (i.match("\n"))
            i = `\n${i}`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送消息：${i}`)
      }
    }
    return { message_id: Date.now() }
  }

  recallMsg(message_id) {
    logger.info(`${logger.blue(`[${this.id}]`)} 撤回消息：${message_id}`)
  }

  async sendFile(file, name = path.basename(file)) {
    const buffer = await Bot.Buffer(file)
    if (!Buffer.isBuffer(buffer)) {
      logger.error(`${logger.blue(`[${this.id}]`)} 发送文件错误：找不到文件 ${logger.red(file)}`)
      return false
    }

    const files = `${this.path}${Date.now()}-${name}`
    logger.info(`${logger.blue(`[${this.id}]`)} 发送文件：${file}\n文件已保存到：${logger.cyan(files)}`)
    return fs.writeFileSync(files, buffer)
  }

  pickFriend() {
    return {
      user_id: this.id,
      nickname: this.name,
      group_id: this.id,
      group_name: this.name,
      sendMsg: msg => this.sendMsg(msg),
      recallMsg: message_id => this.recallMsg(message_id),
      sendFile: (file, name) => this.sendFile(file, name),
    }
  }

  message(msg) {
    const data = {
      bot: Bot[this.id],
      self_id: this.id,
      user_id: this.id,
      post_type: "message",
      message_type: "private",
      sender: { user_id: this.id, nickname: this.name },
      message: [{ type: "text", text: msg }],
      raw_message: msg,
      friend: this.pickFriend(),
    }
    logger.info(`${logger.blue(`[${data.self_id}]`)} 系统消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)

    Bot.em(`${data.post_type}.${data.message_type}`, data)
  }

  load() {
    Bot[this.id] = {
      adapter: this,
      uin: this.id,
      nickname: this.name,
      stat: { start_time: Date.now()/1000 },
      version: { id: this.id, name: this.name },
      pickFriend: () => this.pickFriend(),
      get pickUser() { return this.pickFriend },
      get pickMember() { return this.pickFriend },
      get pickGroup() { return this.pickFriend },

      fl: new Map().set(this.id, {
        user_id: this.id,
        nickname: this.name,
        group_id: this.id,
        group_name: this.name,
      }),
      get gl() { return this.fl },
      gml: new Map,
    }
    Bot[this.id].gml.set(this.id, Bot[this.id].fl)

    process[this.id].on("data", data => this.message(data.toString()))

    logger.mark(`${logger.blue(`[${this.id}]`)} ${this.name}(${this.id}) 已连接`)
    Bot.em(`connect.${this.id}`, { self_id: this.id })
  }
})