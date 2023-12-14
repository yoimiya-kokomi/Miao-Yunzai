import "./config/init.js"
import cfg from "./config/config.js"
import PluginsLoader from "./plugins/loader.js"
import ListenerLoader from "./listener/loader.js"
import { EventEmitter } from "events"
import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import _ from "lodash"
import fs from "node:fs"
import fetch from "node-fetch"
import { randomUUID } from "crypto"
import { exec } from "child_process"
import { fileTypeFromBuffer } from "file-type"
import md5 from "md5"

export default class Yunzai extends EventEmitter {
  constructor() {
    super()
    this.uin = []
    this.adapter = []

    this.express = express()
    this.server = http.createServer(this.express)

    this.server.on("upgrade", (...args) => this.wsConnect(...args))
    this.wss = new WebSocketServer({ noServer: true })
    this.wsf = {}

    this.fs = {}
    this.express.use("/File", (...args) => this.fileSend(...args))
    this.fileToUrl("resources/http/File/404.jpg", { name: 404, time: 0 })
    this.fileToUrl("resources/http/File/timeout.jpg", { name: "timeout", time: 0 })
  }

  wsConnect(req, socket, head) {
    this.wss.handleUpgrade(req, socket, head, conn => {
      conn.id = `${req.connection.remoteAddress}-${req.headers["sec-websocket-key"]}`
      this.makeLog("mark", `${logger.blue(`[${conn.id} <=> ws://${req.headers.host}${req.url}]`)} 建立连接：${JSON.stringify(req.headers)}`)
      conn.on("error", logger.error)
      conn.on("close", () => this.makeLog("mark", `${logger.blue(`[${conn.id} <≠> ws://${req.headers.host}${req.url}]`)} 断开连接`))
      conn.on("message", msg => this.makeLog("debug", `${logger.blue(`[${conn.id} => ws://${req.headers.host}${req.url}]`)} 消息：${String(msg).trim()}`))
      conn.sendMsg = msg => {
        if (!Buffer.isBuffer(msg)) msg = this.String(msg)
        this.makeLog("debug", `${logger.blue(`[${conn.id} <= ws://${req.headers.host}${req.url}]`)} 消息：${msg}`)
        return conn.send(msg)
      }
      for (const i of this.wsf[req.url.split("/")[1]] || [])
        i(conn, req, socket, head)
    })
  }

  serverLoad() {
    this.express.use(req => {
      logger.mark(`${logger.blue(`[${req.ip} => http://${req.headers.host}${req.url}]`)} HTTP ${req.method} 请求：${JSON.stringify(req.headers)}`)
      req.res.redirect("https://github.com/TimeRainStarSky/Yunzai")
    })

    this.server.listen(cfg.bot.port, () => {
      logger.mark(`启动 HTTP 服务器：${logger.green(`http://[${this.server.address().address}]:${this.server.address().port}`)}`)
      const url = cfg.bot.url.replace(/^http/, "ws")
      for (const i of Object.keys(this.wsf))
        logger.info(`${i} 连接地址：${logger.blue(`${url}/${i}`)}`)
    })
  }

  async run() {
    await import("./plugins/stdin.js")
    await PluginsLoader.load()
    await ListenerLoader.load()
    this.serverLoad()
    this.emit("online", this)
  }

  sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
  }

  String(data) {
    switch (typeof data) {
      case "string":
        return data
      case "object":
        return JSON.stringify(data)
    }
    return String(data)
  }

  Buffer(data, opts = {}) {
    if (Buffer.isBuffer(data)) return data
    data = this.String(data)

    if (data.match(/^base64:\/\//)) {
      return Buffer.from(data.replace(/^base64:\/\//, ""), "base64")
    } else if (data.match(/^https?:\/\//)) {
      if (opts.http) return data
      return (async () => Buffer.from(await (await fetch(data)).arrayBuffer()))()
    } else if (fs.existsSync(data.replace(/^file:\/\//, ""))) {
      if (opts.file) return data
      return Buffer.from(fs.readFileSync(data.replace(/^file:\/\//, "")))
    }
    return data
  }

  async fileType(data, name) {
    const file = {}
    try {
      if (Buffer.isBuffer(data)) {
        file.url = name || "Buffer"
        file.buffer = data
      } else {
        file.url = data.replace(/^base64:\/\/.*/, "base64://...")
        file.buffer = await this.Buffer(data)
      }
      if (Buffer.isBuffer(file.buffer)) {
        file.type = await fileTypeFromBuffer(file.buffer)
        file.md5 = md5(file.buffer)
        file.name = name || `${Date.now()}.${file.md5.slice(0,8)}.${file.type.ext}`
      } else {
        file.name = name || `${Date.now()}-path.basename(file.buffer)`
      }
    } catch (err) {
      logger.error(`文件类型检测错误：${logger.red(err)}`)
    }
    return file
  }

  async fileToUrl(file, opts = {}) {
    const { name, time = 60000, times } = opts

    file = await this.fileType(file, name)
    if (!Buffer.isBuffer(file.buffer)) return file.buffer
    if (!file.name) file.name = randomUUID()

    if (typeof times == "number") file.times = times
    this.fs[file.name] = file
    if (time) setTimeout(() => this.fs[file.name] = this.fs.timeout, time)
    return `${cfg.bot.url}/File/${file.name}`
  }

  fileSend(req) {
    const url = req.url.replace(/^\//, "")
    let file = this.fs[url]
    if (!file) file = this.fs[404]

    if (typeof file.times == "number") {
      if (file.times > 0) file.times = file.times-1
      else file = this.fs.timeout
    }

    if (file.type?.mime)
      req.res.setHeader("Content-Type", file.type.mime)

    logger.mark(`${logger.blue(`[${req.ip} => http://${req.headers.host}/File/${url}]`)} HTTP ${req.method} 请求：${JSON.stringify(req.headers)}`)
    logger.mark(`${logger.blue(`[${req.ip} <= http://${req.headers.host}/File/${url}]`)} 发送文件：${file.name}(${file.url} ${(file.buffer.length/1024).toFixed(2)}KB)`)
    req.res.send(file.buffer)
  }

  async exec(cmd) {
    return new Promise(resolve => {
      this.makeLog("mark", `[命令执行开始] ${logger.blue(cmd)}`)
      exec(cmd, (error, stdout, stderr) => {
        this.makeLog("mark", `[命令执行完成] ${logger.blue(cmd)}${stdout?`\n${this.String(stdout).trim()}`:""}${stderr?logger.red(`\n${this.String(stderr).trim()}`):""}`)
        if (error) this.makeLog("mark", `[命令执行错误] ${logger.blue(cmd)}\n${logger.red(this.String(error).trim())}`)
        resolve({ error, stdout, stderr })
      })
    })
  }

  makeLog(level, msg, id) {
    msg = _.truncate(msg.replace(/{"type":"Buffer","data":\[.*?\]}/g, "(Buffer)"), { length: cfg.bot.log_length })
    if (id) msg = `${logger.blue(`[${id}]`)} ${msg}`
    logger[level](msg)
  }

  em(name = "", data = {}) {
    if (data.self_id)
      Object.defineProperty(data, "bot", { value: Bot[data.self_id] })
    while (true) {
      this.emit(name, data)
      const i = name.lastIndexOf(".")
      if (i == -1) break
      name = name.slice(0, i)
    }
  }

  getFriendArray() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].fl || [])
        array.push({ ...i, bot_id })
    return array
  }

  getFriendList() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].fl || [])
        array.push(id)
    return array
  }

  getFriendMap() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].fl || [])
        map.set(id, { ...i, bot_id })
    return map
  }
  get fl() { return this.getFriendMap() }

  getGroupArray() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].gl || [])
        array.push({ ...i, bot_id })
    return array
  }

  getGroupList() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].gl || [])
        array.push(id)
    return array
  }

  getGroupMap() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].gl || [])
        map.set(id, { ...i, bot_id })
    return map
  }
  get gl() { return this.getGroupMap() }
  get gml() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].gml || [])
        map.set(id, i)
    return map
  }

  pickFriend(user_id) {
    user_id = Number(user_id) || String(user_id)
    const user = this.fl.get(user_id)
    if (user) return this[user.bot_id].pickFriend(user_id)
    logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
  }
  get pickUser() { return this.pickFriend }

  pickGroup(group_id) {
    group_id = Number(group_id) || String(group_id)
    const group = this.gl.get(group_id)
    if (group) return this[group.bot_id].pickGroup(group_id)
    logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
  }

  pickMember(group_id, user_id) {
    const group = this.pickGroup(group_id)
    if (group) return group.pickMember(user_id)
  }

  sendFriendMsg(bot_id, user_id, msg) {
    try {
      if (!bot_id)
        return this.pickFriend(user_id).sendMsg(msg)

      if (this[bot_id])
        return this[bot_id].pickFriend(user_id).sendMsg(msg)

      return new Promise(resolve =>
        this.once(`connect.${bot_id}`, data =>
          resolve(data.bot.pickFriend(user_id).sendMsg(msg))))
    } catch (err) {
      logger.error(`${logger.blue(`[${bot_id}]`)} 发送好友消息失败：[$${user_id}] ${err}`)
    }
    return false
  }

  sendGroupMsg(bot_id, group_id, msg) {
    try {
      if (!bot_id)
        return this.pickGroup(group_id).sendMsg(msg)

      if (this[bot_id])
        return this[bot_id].pickGroup(group_id).sendMsg(msg)

      return new Promise(resolve =>
        this.once(`connect.${bot_id}`, data =>
          resolve(data.bot.pickGroup(group_id).sendMsg(msg))))
    } catch (err) {
      logger.error(`${logger.blue(`[${bot_id}]`)} 发送群消息失败：[$${group_id}] ${err}`)
    }
    return false
  }

  async getTextMsg(fnc = () => true) {
    if (typeof fnc != "function") {
      const { self_id, user_id } = fnc
      fnc = data => data.self_id == self_id && data.user_id == user_id
    }

    while (true) {
      const msg = await new Promise(resolve => {
        this.once("message", data => {
          if (data.message && fnc(data)) {
            let msg = ""
            for (const i of data.message)
              if (i.type = "text")
                msg += i.text.trim()
            resolve(msg)
          } else {
            resolve(false)
          }
        })
      })
      if (msg) return msg
    }
  }

  getMasterMsg() {
    return this.getTextMsg(data =>
      cfg.master[data.self_id]?.includes(String(data.user_id)))
  }

  sendMasterMsg(msg) {
    for (const bot_id in cfg.master)
      for (const user_id of cfg.master[bot_id])
        this.sendFriendMsg(bot_id, user_id, msg)
  }

  makeForwardMsg(msg) { return { type: "node", data: msg } }

  async sendForwardMsg(send, msg) {
    const messages = []
    for (const { message } of msg)
      messages.push(await send(message))
    return messages
  }
}