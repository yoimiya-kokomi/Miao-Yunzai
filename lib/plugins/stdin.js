import readline from "node:readline/promises"
import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

Bot.adapter.push(new class stdinAdapter {
  constructor() {
    this.id = "stdin"
    this.name = "标准输入"
    this.path = "data/stdin/"
    this.catimg = file => new Promise(resolve =>
      spawn("catimg", ["-l0", file], { stdio: "inherit" })
        .on("error", () => this.catimg = () => {})
        .on("close", resolve)
    )
  }

  async sendMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", text: i }

      let file
      if (i.file) {
        file = await Bot.fileType(i)
        if (Buffer.isBuffer(file.buffer)) {
          file.path = `${this.path}${file.name}`
          await fs.writeFile(file.path, file.buffer)
          file.url = `${file.url}\n路径: ${logger.cyan(file.path)}\n网址: ${logger.green(await Bot.fileToUrl(file))}`
        }
      }

      switch (i.type) {
        case "text":
          if (i.text.match("\n"))
            i.text = `发送文本: \n${i.text}`
          Bot.makeLog("info", i.text, this.id)
          break
        case "image":
          await this.catimg(file.path)
          Bot.makeLog("info", `发送图片: ${file.url}`, this.id)
          break
        case "record":
          Bot.makeLog("info", `发送音频: ${file.url}`, this.id)
          break
        case "video":
          Bot.makeLog("info", `发送视频: ${file.url}`, this.id)
          break
        case "file":
          Bot.makeLog("info", `发送文件: ${file.url}`, this.id)
          break
        case "reply":
          break
        case "at":
          break
        case "node":
          Bot.sendForwardMsg(msg => this.sendMsg(msg), i.data)
          break
        default:
          Bot.makeLog("info", i, this.id)
      }
    }
    return { message_id: Date.now().toString(36) }
  }

  recallMsg(message_id) {
    Bot.makeLog("info", `撤回消息: ${message_id}`, this.id)
  }

  async sendFile(file, name = path.basename(file)) {
    return this.sendMsg(segment.file(file, name))
  }

  pickFriend() {
    return {
      sendMsg: msg => this.sendMsg(msg),
      recallMsg: message_id => this.recallMsg(message_id),
      sendFile: (file, name) => this.sendFile(file, name),
      pickMember: function() { return this },
    }
  }

  message(msg) {
    fs.appendFile(`${this.path}history`, `${Date.now().toString(36)}:${msg}\n`, "utf8")
    const data = {
      bot: Bot[this.id],
      self_id: this.id,
      user_id: this.id,
      post_type: "message",
      message_type: "private",
      sender: { user_id: this.id, nickname: this.name },
      message: [{ type: "text", text: msg }],
      raw_message: msg,
    }
    Bot.makeLog("info", `系统消息: ${data.raw_message}`, this.id)
    Bot.em(`${data.post_type}.${data.message_type}`, data)
  }

  async load(force) {
    if (!(process.stdin.isTTY || process.env.FORCE_TTY || force)) return

    await Bot.mkdir(this.path)
    Bot[this.id] = {
      adapter: this,
      sdk: readline.createInterface({
        input: process.stdin,
        output: process.stderr,
      }).on("line", data => this.message(String(data)))
        .on("close", () => process.exit(1)),

      uin: this.id,
      nickname: this.name,
      version: { id: this.id, name: this.name },

      pickFriend: () => this.pickFriend(),
      get stat() { return Bot.stat },
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

    try {
      Bot[this.id].sdk.history = (await fs.readFile(`${this.path}history`, "utf8")).split("\n").slice(-Bot[this.id].sdk.historySize-1, -1).map(i => i.replace(/^[0-9a-z]+?:/, "")).reverse()
    } catch (err) {
      Bot.makeLog("trace", err, this.id)
    }

    Bot.makeLog("mark", `${this.name}(${this.id}) 已连接`, this.id)
    Bot.em(`connect.${this.id}`, { self_id: this.id })
  }
})