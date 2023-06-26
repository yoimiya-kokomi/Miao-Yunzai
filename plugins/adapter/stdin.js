import fs from "node:fs"
import path from "node:path"

Bot.adapter.push(new class stdinAdapter {
  constructor() {
    this.id = "stdin"
    this.name = "标准输入"
  }

  async makeBuffer(file) {
    if (file.match(/^base64:\/\//))
      return Buffer.from(file.replace(/^base64:\/\//, ""), "base64")
    else if (file.match(/^https?:\/\//))
      return Buffer.from(await (await fetch(file)).arrayBuffer())
    else if (fs.existsSync(file))
      return Buffer.from(fs.readFileSync(file))
    else
      return file
  }

  async sendMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", data: { text: i }}
      else if (!i.data)
        i = { type: i.type, data: { ...i, type: undefined }}
      switch (i.type) {
        case "text":
          if (i.data.text.match("\n"))
            i.data.text = `\n${i.data.text}`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送文本：${i.data.text}`)
          break
        case "image":
          i.file = `${Bot[this.id].data_dir}${Date.now()}.png`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送图片：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "record":
          i.file = `${Bot[this.id].data_dir}${Date.now()}.mp3`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送音频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "video":
          i.file = `${Bot[this.id].data_dir}${Date.now()}.mp4`
          logger.info(`${logger.blue(`[${this.id}]`)} 发送视频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "reply":
          break
        case "at":
          break
        case "node":
          this.sendForwardMsg(i.data)
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

  sendForwardMsg(msg) {
    const messages = []
    for (const i of msg)
      messages.push(this.sendMsg(i.message))
    return messages
  }

  async sendFile(file, name = path.basename(file)) {
    const buffer = await this.makeBuffer(file)
    if (!Buffer.isBuffer(buffer)) {
      logger.error(`${logger.blue(`[${this.id}]`)} 发送文件错误：找不到文件 ${logger.red(file)}`)
      return false
    }

    const files = `${Bot[this.id].data_dir}${Date.now()}-${name}`
    logger.info(`${logger.blue(`[${this.id}]`)} 发送文件：${file}\n文件已保存到：${logger.cyan(files)}`)
    return fs.writeFileSync(files, buffer)
  }

  pickFriend() {
    return {
      sendMsg: msg => this.sendMsg(msg),
      recallMsg: message_id => this.recallMsg(message_id),
      makeForwardMsg: Bot.makeForwardMsg,
      sendForwardMsg: msg => this.sendForwardMsg(msg),
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
      sender: { nickname: this.name },
      message: [{ type: "text", text: msg }],
      raw_message: msg,
      friend: this.pickFriend(),
    }
    logger.info(`${logger.blue(`[${data.self_id}]`)} 系统消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)

    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  load() {
    Bot[this.id] = {
      uin: this.id,
      nickname: this.name,
      stat: { start_time: Date.now()/1000 },
      version: { id: this.id, name: this.name },
      pickFriend: () => this.pickFriend(),
      pickUser: () => this.pickFriend(),
      pickGroup: () => this.pickFriend(),
      pickMember: () => this.pickFriend(),

      fl: new Map().set(this.id, {
        user_id: this.id,
        nickname: this.name,
      }),
      gl: new Map().set(this.id, {
        group_id: this.id,
        group_name: this.name,
      }),

      data_dir: `${process.cwd()}/data/stdin/`,
    }

    if (!fs.existsSync(Bot[this.id].data_dir))
      fs.mkdirSync(Bot[this.id].data_dir)

    if (!Bot.uin.includes(this.id))
      Bot.uin.push(this.id)

    process[this.id].on("data", data => this.message(data.toString()))

    logger.mark(`${logger.blue(`[${this.id}]`)} ${this.name}(${this.id}) 已连接`)
    Bot.emit(`connect.${this.id}`, Bot[this.id])
    Bot.emit(`connect`, Bot[this.id])
  }
})