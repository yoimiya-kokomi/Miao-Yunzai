import init from "./config/init.js"
import cfg from "./config/config.js"
import PluginsLoader from "./plugins/loader.js"
import ListenerLoader from "./listener/loader.js"
import { EventEmitter } from "events"
import util from "./util.js"
import express from "express"
import http from "node:http"
import { WebSocketServer } from "ws"
import fs from "node:fs/promises"
import fetch from "node-fetch"
import { ulid } from "ulid"

export default class Yunzai extends EventEmitter {
  stat = { start_time: Date.now()/1000 }
  bot = this
  bots = {}
  uin = Object.assign([], {
    toJSON() {
      if (!this.now) {
        switch (this.length) {
          case 0:
            return ""
          case 1:
          case 2:
            return this[this.length-1]
        }
        const array = this.slice(1)
        this.now = array[Math.floor(Math.random()*array.length)]
        setTimeout(() => delete this.now, 60000)
      }
      return this.now
    },
    toString(raw, ...args) {
      return raw === true ?
        this.__proto__.toString.apply(this, args) :
        this.toJSON().toString(raw, ...args)
    },
    includes(value) {
      return this.some(i => i == value)
    },
  })
  adapter = []

  express = Object.assign(express(), { skip_auth: [], quiet: [] })
    .use(this.serverAuth.bind(this))
    .use("/status", this.serverStatus.bind(this))
    .use(express.urlencoded({ extended: false }))
    .use(express.json())
    .use(express.raw())
    .use(express.text())
    .use(this.serverHandle.bind(this))
    .use("/exit", this.serverExit.bind(this))
    .use("/File", this.fileSend.bind(this))

  server = http.createServer(this.express)
    .on("error", err => {
      if (typeof this[`server${err.code}`] === "function")
        return this[`server${err.code}`](err)
      util.makeLog("error", err, "Server")
    })
    .on("upgrade", this.wsConnect.bind(this))

  wss = new WebSocketServer({ noServer: true })
  wsf = Object.create(null)
  fs = Object.create(null)

  constructor() {
    super()

    for (const name of [404, "timeout"])
      this.fileToUrl(`resources/http/File/${name}.jpg`, { name, time: false, times: false })

    return new Proxy(this.bots, {
      get: (target, prop) => {
        const value = this[prop] ?? util[prop] ?? target[prop]
        if (value !== undefined) return value
        for (const i of [this.uin.toString(), ...this.uin])
          if (target[i]?.[prop] !== undefined) {
            util.makeLog("trace", `因不存在 Bot.${prop} 而重定向到 Bot.${i}.${prop}`)
            if (typeof target[i][prop]?.bind === "function")
              return target[i][prop].bind(target[i])
            return target[i][prop]
          }
        util.makeLog("trace", `不存在 Bot.${prop}`)
      }
    })
  }

  serverAuth(req) {
    req.rid ??= `${req.ip}:${req.socket.remotePort}`
    req.sid ??= `${req.protocol}://${req.hostname}:${req.socket.localPort}${req.originalUrl}`
    if (!cfg.server.auth || !Object.keys(cfg.server.auth).length)
      return req.next?.()

    for (const i of req.app?.skip_auth || [])
      if (req.originalUrl.startsWith(i))
        return req.next()

    for (const i in cfg.server.auth) {
      if (req.headers[i.toLowerCase()] === cfg.server.auth[i] || req.query[i] === cfg.server.auth[i])
        continue
      req.res?.sendStatus(401)

      const msg = { headers: req.headers }
      if (Object.keys(req.query).length)
        msg.query = req.query
      util.makeLog("error", ["HTTP", req.method, "请求", i, "鉴权失败", msg], `${req.sid} <≠ ${req.rid}`, true)
      return false
    }
    req.next?.()
  }

  serverStatus(req) {
    req.res.type("json")
    req.res.send(JSON.stringify({
      ...process, memory: process.memoryUsage(),
    }).replace(/(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g, "[IPv4]"))
  }

  serverHandle(req) {
    let quiet = false
    for (const i of req.app.quiet)
      if (req.originalUrl.startsWith(i)) {
        quiet = true
        break
      }

    const msg = { headers: req.headers }
    for (const i of ["query", "body"])
      if (Object.keys(req[i]).length)
        msg[i] = req[i]
    util.makeLog(quiet?"debug":"mark", ["HTTP", req.method, "请求", msg], `${req.sid} <= ${req.rid}`, true)
    req.next()
  }

  async serverExit(req) {
    if (req.ip !== "::1" && req.ip !== "::ffff:127.0.0.1" && req.hostname !== "localhost") return
    if (process.env.app_type === "pm2")
      await util.exec("pnpm stop")
    process.exit(1)
  }

  wsConnect(req, socket, head) {
    req.rid = `${req.socket.remoteAddress}:${req.socket.remotePort}-${req.headers["sec-websocket-key"]}`
    req.sid = `ws://${req.headers["x-forwarded-host"] || req.headers.host || `${req.socket.localAddress}:${req.socket.localPort}`}${req.url}`
    req.query = Object.fromEntries(new URL(req.sid).searchParams.entries())
    if (this.serverAuth(req) === false) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      return socket.destroy()
    }

    const msg = { headers: req.headers }
    if (Object.keys(req.query).length)
      msg.query = req.query

    const path = req.url.split("/")[1]
    if (!(path in this.wsf)) {
      util.makeLog("error", ["WebSocket 处理器", path, "不存在", msg], `${req.sid} <≠> ${req.rid}`, true)
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n")
      return socket.destroy()
    }

    this.wss.handleUpgrade(req, socket, head, conn => {
      util.makeLog("mark", ["建立连接", msg], `${req.sid} <=> ${req.rid}`, true)
      conn.on("error", (...args) => util.makeLog("error", args, `${req.sid} <=> ${req.rid}`, true))
      conn.on("close", () => util.makeLog("mark", "断开连接", `${req.sid} <≠> ${req.rid}`, true))
      conn.on("message", msg => util.makeLog("debug", ["消息", util.String(msg)], `${req.sid} <= ${req.rid}`, true))
      conn.sendMsg = msg => {
        if (!Buffer.isBuffer(msg)) msg = util.String(msg)
        util.makeLog("debug", ["消息", msg], `${req.sid} => ${req.rid}`, true)
        return conn.send(msg)
      }
      for (const i of this.wsf[path])
        i(conn, req, socket, head)
    })
  }

  async serverEADDRINUSE(err, https) {
    util.makeLog("error", ["监听端口", https ? cfg.server.https.port : cfg.server.port, "错误", err], "Server")
    if (https) return
    try {
      await fetch(`http://localhost:${cfg.server.port}/exit`, { headers: cfg.server.auth || undefined })
    } catch {}
    this.server_listen_time = (this.server_listen_time || 0) + 1
    await util.sleep(this.server_listen_time * 1000)
    this.server.listen(cfg.server.port)
  }

  async serverLoad(https) {
    const server = https ? "httpsServer" : "server"
    this[server].listen(https ? cfg.server.https.port : cfg.server.port)
    try {
      await util.promiseEvent(this[server], "listening", https && "error")
    } catch (err) {
      return
    }
    const { address, port } = this[server].address()
    util.makeLog("mark", [`启动 HTTP${https?"S":""} 服务器`, logger.green(`http${https?"s":""}://[${address}]:${port}`)], "Server")
    this.url = https ? cfg.server.https.url : cfg.server.url
  }

  async httpsLoad() {
    try {
      this.httpsServer = (await import("node:https")).createServer({
        key: await fs.readFile(cfg.server.https.key),
        cert: await fs.readFile(cfg.server.https.cert),
      }, this.express)
        .on("error", err => {
          if (typeof this[`server${err.code}`] === "function")
            return this[`server${err.code}`](err, true)
          util.makeLog("error", err, "Server")
        })
        .on("upgrade", this.wsConnect.bind(this))
      return this.serverLoad(true)
    } catch (err) {
      util.makeLog("error", ["创建 HTTPS 服务器错误", err], "Server")
    }
  }

  async run() {
    await init()
    await this.serverLoad()
    if (cfg.server.https && cfg.server.https.key && cfg.server.https.cert)
      await this.httpsLoad()
    await import("./plugins/stdin.js")
    await PluginsLoader.load()
    await ListenerLoader.load()

    this.express.use(req => req.res.redirect(cfg.server.redirect))
    util.makeLog("info", `连接地址：${logger.blue(`${this.url.replace(/^http/, "ws")}/`)}${logger.cyan(`[${Object.keys(this.wsf)}]`)}`, "WebSocket")
    this.emit("online", this)
  }

  async fileToUrl(file, opts = {}) {
    const {
      name,
      time = cfg.bot.file_to_url_time*60000,
      times = cfg.bot.file_to_url_times,
    } = opts

    file = (typeof file === "object" && !Buffer.isBuffer(file) && { ...file }) ||
      await util.fileType({ file, name }, { http: true })
    if (!Buffer.isBuffer(file.buffer)) return file.buffer
    file.name = file.name ? encodeURIComponent(file.name) : ulid()

    if (typeof times === "number") file.times = times
    this.fs[file.name] = file
    if (time) setTimeout(() => this.fs[file.name] = this.fs.timeout, time)
    return `${this.url}/File/${file.name}`
  }

  fileSend(req) {
    const url = req.url.replace(/^\//, "")
    let file = this.fs[url] || this.fs[404]

    if (typeof file.times === "number") {
      if (file.times > 0) file.times--
      else file = this.fs.timeout
    }

    if (file.type?.mime)
      req.res.setHeader("Content-Type", file.type.mime)

    util.makeLog("mark", `发送文件：${file.name}(${file.url} ${(file.buffer.length/1024).toFixed(2)}KB)`, `${req.sid} => ${req.rid}`, true)
    req.res.send(file.buffer)
  }

  prepareEvent(data) {
    if (!this.bots[data.self_id]) return
    if (!data.bot) Object.defineProperty(data, "bot", {
      value: this.bots[data.self_id],
    })

    if (data.user_id) {
      if (!data.friend) Object.defineProperty(data, "friend", {
        value: data.bot.pickFriend(data.user_id),
      })
      data.sender ||= { user_id: data.user_id }
      data.sender.nickname ||= data.friend.name || data.friend.nickname
    }

    if (data.group_id) {
      if (!data.group) Object.defineProperty(data, "group", {
        value: data.bot.pickGroup(data.group_id),
      })
      data.group_name ||= data.group.name || data.group.group_name
    }

    if (data.group && data.user_id) {
      if (!data.member) Object.defineProperty(data, "member", {
        value: data.group.pickMember(data.user_id),
      })
      data.sender.nickname ||= data.member.name || data.member.nickname
      data.sender.card ||= data.member.card
    }

    if (data.bot.adapter?.id)
      data.adapter_id = data.bot.adapter.id
    if (data.bot.adapter?.name)
      data.adapter_name = data.bot.adapter.name

    for (const i of [data.friend, data.group, data.member]) {
      if (typeof i !== "object") continue
      i.sendFile ??= (file, name) => i.sendMsg(segment.file(file, name))
      i.makeForwardMsg ??= this.makeForwardMsg
      i.sendForwardMsg ??= msg => this.sendForwardMsg(msg => i.sendMsg(msg), msg)
      i.getInfo ??= () => i.info || i
    }

    if (!data.reply) {
      if (data.group?.sendMsg)
        data.reply = data.group.sendMsg.bind(data.group)
      else if (data.friend?.sendMsg)
        data.reply = data.friend.sendMsg.bind(data.friend)
    }
  }

  em(name = "", data = {}) {
    this.prepareEvent(data)
    while (true) {
      this.emit(name, data)
      const i = name.lastIndexOf(".")
      if (i === -1) break
      name = name.slice(0, i)
    }
  }

  getFriendArray() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this.bots[bot_id].fl || [])
        array.push({ ...i, bot_id })
    return array
  }

  getFriendList() {
    const array = []
    for (const bot_id of this.uin)
      array.push(...(this.bots[bot_id].fl?.keys() || []))
    return array
  }

  getFriendMap() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this.bots[bot_id].fl || [])
        map.set(id, { ...i, bot_id })
    return map
  }
  get fl() { return this.getFriendMap() }

  getGroupArray() {
    const array = []
    for (const bot_id of this.uin)
      for (const [id, i] of this.bots[bot_id].gl || [])
        array.push({ ...i, bot_id })
    return array
  }

  getGroupList() {
    const array = []
    for (const bot_id of this.uin)
      array.push(...(this.bots[bot_id].gl?.keys() || []))
    return array
  }

  getGroupMap() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this.bots[bot_id].gl || [])
        map.set(id, { ...i, bot_id })
    return map
  }
  get gl() { return this.getGroupMap() }
  get gml() {
    const map = new Map
    for (const bot_id of this.uin)
      for (const [id, i] of this.bots[bot_id].gml || [])
        map.set(id, Object.assign(new Map(i), { bot_id }))
    return map
  }

  pickFriend(user_id, strict) {
    user_id = Number(user_id) || user_id
    if (this.bots[this.uin]?.fl.has(user_id))
      return this.bots[this.uin].pickFriend(user_id)
    let user = this.fl.get(user_id)
    if (!user) for (const [id, ml] of this.gml) {
      user = ml.get(user_id)
      if (user) {
        user.bot_id = ml.bot_id
        break
      }
    }
    if (user) return this.bots[user.bot_id].pickFriend(user_id)
    if (strict) return false
    util.makeLog("debug", ["因不存在用户", user_id, "而随机选择Bot", this.uin.toJSON()])
    return this.bots[this.uin].pickFriend(user_id)
  }
  get pickUser() { return this.pickFriend }

  pickGroup(group_id, strict) {
    group_id = Number(group_id) || group_id
    if (this.bots[this.uin]?.gl.has(group_id))
      return this.bots[this.uin].pickGroup(group_id)
    const group = this.gl.get(group_id)
    if (group) return this.bots[group.bot_id].pickGroup(group_id)
    if (strict) return false
    util.makeLog("debug", ["因不存在群", group_id, "而随机选择Bot", this.uin.toJSON()])
    return this.bots[this.uin].pickGroup(group_id)
  }

  pickMember(group_id, user_id) {
    return this.pickGroup(group_id).pickMember(user_id)
  }

  sendFriendMsg(bot_id, user_id, ...args) { try {
    if (!bot_id)
      return this.pickFriend(user_id).sendMsg(...args)

    if (this.uin.includes(bot_id) && this.bots[bot_id])
      return this.bots[bot_id].pickFriend(user_id).sendMsg(...args)

    if (this.pickFriend(bot_id, true))
      return this.pickFriend(bot_id).sendMsg(user_id, ...args)

    return new Promise((resolve, reject) => {
      const listener = data => {
        resolve(data.bot.pickFriend(user_id).sendMsg(...args))
        clearTimeout(timeout)
      }
      const timeout = setTimeout(() => {
        reject(Object.assign(Error("等待 Bot 上线超时"), { bot_id, user_id, args }))
        this.off(`connect.${bot_id}`, listener)
      }, 300000)
      this.once(`connect.${bot_id}`, listener)
    })
  } catch (err) {
    util.makeLog("error", ["发送好友消息错误", args, err], `${bot_id} => ${user_id}`, true)
  }}

  sendGroupMsg(bot_id, group_id, ...args) { try {
    if (!bot_id)
      return this.pickGroup(group_id).sendMsg(...args)

    if (this.uin.includes(bot_id) && this.bots[bot_id])
      return this.bots[bot_id].pickGroup(group_id).sendMsg(...args)

    if (this.pickGroup(bot_id, true))
      return this.pickGroup(bot_id).sendMsg(group_id, ...args)

    return new Promise((resolve, reject) => {
      const listener = data => {
        resolve(data.bot.pickGroup(group_id).sendMsg(...args))
        clearTimeout(timeout)
      }
      const timeout = setTimeout(() => {
        reject(Object.assign(Error("等待 Bot 上线超时"), { bot_id, group_id, args }))
        this.off(`connect.${bot_id}`, listener)
      }, 300000)
      this.once(`connect.${bot_id}`, listener)
    })
  } catch (err) {
    util.makeLog("error", ["发送群消息错误", args, err], `${bot_id} => ${group_id}`, true)
  }}

  getTextMsg(fnc = () => true) {
    if (typeof fnc !== "function") {
      const { self_id, user_id } = fnc
      fnc = data => data.self_id == self_id && data.user_id == user_id
    }

    return new Promise(resolve => {
      const listener = data => { try {
        if (!fnc(data)) return

        let msg = ""
        for (const i of data.message)
          if (i.type === "text" && i.text)
            msg += i.text.trim()
        if (!msg) return

        resolve(msg)
        this.off("message", listener)
      } catch (err) {
        util.makeLog("error", err, data.self_id)
      }}
      this.on("message", listener)
    })
  }

  getMasterMsg() {
    return this.getTextMsg(data => cfg.master[data.self_id]?.includes(String(data.user_id)))
  }

  async sendMasterMsg(msg, bot_array = Object.keys(cfg.master), sleep = 5000) {
    const ret = {}
    await Promise.allSettled((Array.isArray(bot_array) ? bot_array : [bot_array]).map(async bot_id => {
      ret[bot_id] = {}
      for (const user_id of cfg.master[bot_id] || []) {
        ret[bot_id][user_id] = this.sendFriendMsg(bot_id, user_id, msg)
        if (sleep) await util.sleep(sleep, ret[bot_id][user_id])
      }
    }))
    return ret
  }

  makeForwardMsg(msg) { return { type: "node", data: msg } }

  makeForwardArray(msg = [], node = {}) {
    const forward = []
    for (const message of Array.isArray(msg) ? msg : [msg])
      forward.push({ ...node, message })
    return this.makeForwardMsg(forward)
  }

  async sendForwardMsg(send, msg) {
    const messages = []
    for (const { message } of Array.isArray(msg) ? msg : [msg])
      messages.push(await send(message))
    return messages
  }
}