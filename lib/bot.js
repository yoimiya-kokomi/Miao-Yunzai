import "./config/init.js"
import cfg from "./config/config.js"
import redisInit from "./config/redis.js"
import PluginsLoader from "./plugins/loader.js"
import ListenerLoader from "./listener/loader.js"
import { EventEmitter } from "events"
import express from "express"
import http from "node:http"
import { WebSocketServer } from "ws"
import _ from "lodash"
import fs from "node:fs/promises"
import path from "node:path"
import util from "node:util"
import fetch from "node-fetch"
import { randomUUID } from "node:crypto"
import { exec } from "node:child_process"
import { fileTypeFromBuffer } from "file-type"
import md5 from "md5"
import { Level } from "level"

export default class Yunzai extends EventEmitter {
  constructor() {
    super()
    this.stat = { start_time: Date.now()/1000 }
    this.uin = []
    this.adapter = []

    this.express = express()
    for (const i of ["urlencoded", "json", "raw", "text"])
      this.express.use(express[i]({ extended: false }))
    this.express.use(req => {
      req.rid = `${req.ip}:${req.socket.remotePort}`
      req.sid = `${req.protocol}://${req.hostname}:${req.socket.localPort}${req.originalUrl}`
      this.makeLog("mark", ["HTTP", req.method, "请求", req.headers, req.query, req.body], `${req.sid} <= ${req.rid}`)
      req.next()
    })
    this.express.use("/exit", req => {
      if (["::1", "::ffff:127.0.0.1"].includes(req.ip) || req.hostname == "localhost")
        process.exit(1)
    })
    this.server = http.createServer(this.express)
    this.server.on("error", err => {
      if (typeof this[`server${err.code}`] == "function")
        return this[`server${err.code}`](err)
      this.makeLog("error", err, "Server")
    })

    this.server.on("upgrade", (...args) => this.wsConnect(...args))
    this.wss = new WebSocketServer({ noServer: true })
    this.wsf = Object.create(null)

    this.fs = Object.create(null)
    this.express.use("/File", (...args) => this.fileSend(...args))
    for (const name of [404, "timeout"])
      this.fileToUrl(`resources/http/File/${name}.jpg`, { name, time: false, times: false })
  }

  wsConnect(req, socket, head) {
    this.wss.handleUpgrade(req, socket, head, conn => {
      conn.rid = `${req.socket.remoteAddress}:${req.socket.remotePort}-${req.headers["sec-websocket-key"]}`
      conn.sid = `ws://${req.headers["x-forwarded-host"] || req.headers.host || `${req.socket.localAddress}:${req.socket.localPort}`}${req.url}`
      this.makeLog("mark", ["建立连接", req.headers], `${conn.sid} <=> ${conn.rid}`)
      conn.on("error", (...args) => this.makeLog("error", args, `${conn.sid} <=> ${conn.rid}`))
      conn.on("close", () => this.makeLog("mark", "断开连接", `${conn.sid} <≠> ${conn.rid}`))
      conn.on("message", msg => this.makeLog("debug", ["消息", this.String(msg)], `${conn.sid} <= ${conn.rid}`))
      conn.sendMsg = msg => {
        if (!Buffer.isBuffer(msg)) msg = this.String(msg)
        this.makeLog("debug", ["消息", msg], `${conn.sid} => ${conn.rid}`)
        return conn.send(msg)
      }
      for (const i of this.wsf[req.url.split("/")[1]] || [() => conn.terminate()])
        i(conn, req, socket, head)
    })
  }

  async serverEADDRINUSE(err) {
    this.makeLog("error", ["监听端口", cfg.bot.port, "错误", err], "Server")
    try {
      await fetch(`http://localhost:${cfg.bot.port}/exit`)
    } catch {}
    this.server_listen_time = (this.server_listen_time || 0) + 1
    await this.sleep(this.server_listen_time * 1000)
    this.server.listen(cfg.bot.port)
  }

  async serverLoad() {
    this.server.listen(cfg.bot.port)
    await new Promise(resolve => this.server.once("listening", resolve))
    this.makeLog("mark", ["启动 HTTP 服务器", logger.green(`http://[${this.server.address().address}]:${this.server.address().port}`)], "Server")
  }

  async run() {
    await redisInit()
    await this.serverLoad()
    await import("./plugins/stdin.js")
    await PluginsLoader.load()
    await ListenerLoader.load()

    this.express.use(req => req.res.redirect("https://github.com/TimeRainStarSky/Yunzai"))
    this.makeLog("info", `连接地址：${logger.blue(`${cfg.bot.url.replace(/^http/, "ws")}/`)}${logger.cyan(`[${Object.keys(this.wsf)}]`)}`, "WebSocket")
    this.emit("online", this)
  }

  sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time))
  }

  async fsStat(path) { try {
    return await fs.stat(path)
  } catch (err) {
    this.makeLog("trace", ["获取", path, "状态错误", err])
    return false
  }}

  async mkdir(dir) { try {
    await fs.mkdir(dir, { recursive: true })
    return true
  } catch (err) {
    this.makeLog("error", ["创建", dir, "错误", err])
    return false
  }}

  async rm(file) { try {
    await fs.rm(file, { force: true, recursive: true })
    return true
  } catch (err) {
    this.makeLog("error", ["删除", file, "错误", err])
    return false
  }}

  async download(url, file, opts) {
    let buffer
    if (!file || (await this.fsStat(file))?.isDirectory?.()) {
      const type = await this.fileType(url, opts)
      file = file ? path.join(file, type.name) : type.name
      buffer = type.buffer
    } else {
      await this.mkdir(path.dirname(file))
      buffer = await this.Buffer(url, opts)
    }
    await fs.writeFile(file, buffer)
    return { url, file, buffer }
  }

  makeMap(parent_map, parent_key, map) {
    const save = async () => { try {
      await parent_map.db.put(parent_key, { map_array: Array.from(map) })
    } catch (err) {
      this.makeLog("error", ["写入", parent_map.db.location, parent_key, "错误", map, err])
    }}

    const set = map.set.bind(map)
    Object.defineProperty(map, "set", {
      value: async (key, value) => {
        if (JSON.stringify(map.get(key)) != JSON.stringify(value)) {
          set(key, value)
          await save()
        }
        return map
      },
    })
    const del = map.delete.bind(map)
    Object.defineProperty(map, "delete", {
      value: async key => {
        if (!del(key)) return false
        await save()
        return true
      },
    })
    return map
  }

  async setMap(map, set, key, value) {
    try {
      if (value instanceof Map) {
        set(key, this.makeMap(map, key, value))
        await map.db.put(key, { map_array: Array.from(value) })
      } else if (JSON.stringify(map.get(key)) != JSON.stringify(value)) {
        set(key, value)
        await map.db.put(key, value)
      }
    } catch (err) {
      this.makeLog("error", ["写入", map.db.location, key, "错误", value, err])
    }
    return map
  }

  async delMap(map, del, key) {
    if (!del(key)) return false
    try {
      await map.db.del(key)
    } catch (err) {
      this.makeLog("error", ["删除", map.db.location, key, "错误", err])
    }
    return true
  }

  async importMap(dir, map) {
    for (const i of await fs.readdir(dir)) {
      const path = `${dir}/${i}`
      try {
        await map.set(i, (await this.fsStat(path)).isDirectory() ?
          await this.importMap(path, new Map) :
          JSON.parse(await fs.readFile(path, "utf-8")))
      } catch (err) {
        this.makeLog("error", ["读取", path, "错误", err])
      }
      await this.rm(path)
    }
    await this.rm(dir)
    return map
  }

  async getMap(dir) {
    const map = new Map()
    const db = new Level(`${dir}-leveldb`, { valueEncoding: "json" })
    try {
      await db.open()
      for await (let [key, value] of db.iterator()) {
        if (typeof value == "object" && value.map_array)
          value = this.makeMap(map, key, new Map(value.map_array))
        map.set(key, value)
      }
    } catch (err) {
      this.makeLog("error", ["打开", dir, "数据库错误", err])
      return map
    }

    Object.defineProperty(map, "db", { value: db })
    const set = map.set.bind(map)
    Object.defineProperty(map, "set", {
      value: (key, value) => this.setMap(map, set, key, value),
    })
    const del = map.delete.bind(map)
    Object.defineProperty(map, "delete", {
      value: key => this.delMap(map, del, key),
    })

    if (await this.fsStat(dir))
      await this.importMap(dir, map)
    return map
  }

  StringOrNull(data) {
    if (typeof data == "object" && typeof data.toString != "function")
      return "[object null]"
    return String(data)
  }

  getCircularReplacer() {
    const _this_ = this, ancestors = []
    return function (key, value) {
      switch (typeof value) {
        case "function":
          return String(value)
        case "object":
          if (value instanceof Map || value instanceof Set)
            return Array.from(value)
          if (value !== null) break
        default:
          return value
      }
      while (ancestors.length > 0 && ancestors.at(-1) !== this)
        ancestors.pop()
      if (ancestors.includes(value))
        return `[Circular ${_this_.StringOrNull(value)}]`
      ancestors.push(value)
      return value
    }
  }

  String(data, space) {
    switch (typeof data) {
      case "string":
        return data
      case "function":
        return String(data)
      case "object":
        if (data instanceof Error)
          return data.stack
        if (Buffer.isBuffer(data))
          return String(data)
    }

    try {
      return JSON.stringify(data, this.getCircularReplacer(), space)
    } catch (err) {
      return this.StringOrNull(data)
    }
  }

  Loging(data) {
    if (typeof data == "string") return data
    if (!cfg.bot.log_object) return this.StringOrNull(data)

    return util.inspect(data, {
      depth: 10,
      colors: true,
      showHidden: true,
      showProxy: true,
      getters: true,
      breakLength: 100,
      maxArrayLength: 100,
      maxStringLength: 1000,
      ...cfg.bot.log_object,
    })
  }

  async Buffer(data, opts = {}) {
    if (Buffer.isBuffer(data)) return data
    data = this.String(data)

    if (data.startsWith("base64://"))
      return Buffer.from(data.replace("base64://", ""), "base64")
    else if (data.match(/^https?:\/\//))
      return opts.http ? data : Buffer.from(await (await fetch(data, opts)).arrayBuffer())
    else if (await this.fsStat(data.replace(/^file:\/\//, "")))
      return opts.file ? data : Buffer.from(await fs.readFile(data.replace(/^file:\/\//, "")))
    return data
  }

  async fileType(data, opts = {}) {
    const file = { name: data.name }
    try {
      if (Buffer.isBuffer(data.file)) {
        file.url = data.name || "Buffer"
        file.buffer = data.file
      } else {
        file.url = data.file.replace(/^base64:\/\/.*/, "base64://...")
        file.buffer = await this.Buffer(data.file, opts)
      }
      if (Buffer.isBuffer(file.buffer)) {
        file.type = await fileTypeFromBuffer(file.buffer)
        file.md5 = md5(file.buffer)
        if (!file.name)
          file.name = `${Date.now()}.${file.md5.slice(0,8)}.${file.type.ext}`
      }
    } catch (err) {
      this.makeLog("error", ["文件类型检测错误", file, err])
    }
    if (!file.name)
      file.name = `${Date.now()}-${path.basename(file.url)}`
    return file
  }

  async fileToUrl(file, opts = {}) {
    const {
      name,
      time = cfg.bot.file_to_url_time*60000,
      times = cfg.bot.file_to_url_times,
    } = opts

    file = await this.fileType({ file, name }, { http: true })
    if (!Buffer.isBuffer(file.buffer)) return file.buffer
    file.name = file.name ? encodeURIComponent(file.name) : randomUUID()

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
      if (file.times > 0) file.times--
      else file = this.fs.timeout
    }

    if (file.type?.mime)
      req.res.setHeader("Content-Type", file.type.mime)

    this.makeLog("mark", `发送文件：${file.name}(${file.url} ${(file.buffer.length/1024).toFixed(2)}KB)`, `${req.sid} => ${req.rid}`)
    req.res.send(file.buffer)
  }

  async exec(cmd, opts = {}) {
    return new Promise(resolve => {
      if (!opts.quiet)
        this.makeLog("mark", `[执行命令] ${logger.blue(cmd)}`)
      exec(cmd, opts, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
        if (opts.quiet) return
        this.makeLog("mark", `[执行命令完成] ${logger.blue(cmd)}${stdout?`\n${String(stdout).trim()}`:""}${stderr?logger.red(`\n${String(stderr).trim()}`):""}`)
        if (error) this.makeLog("error", `[执行命令错误] ${logger.blue(cmd)}\n${logger.red(this.Loging(error).trim())}`)
      })
    })
  }

  async cmdPath(cmd, opts = {}) {
    const ret = await this.exec(`${process.platform == "win32" ? "where" : "command -v"} "${cmd}"`, { quiet: true, ...opts })
    if (ret.error) return false
    return ret.stdout.trim()
  }

  makeLog(level, msg, id) {
    const log = []
    if (id) log.push(logger.blue(`[${id}]`))
    for (const i of Array.isArray(msg) ? msg : [msg])
      log.push(_.truncate(this.Loging(i), { length: cfg.bot.log_length }))
    logger[level](...log)
  }

  makeEvent(data) {
    if (!this[data.self_id]) return
    if (!data.bot)
      Object.defineProperty(data, "bot", {
        value: this[data.self_id],
      })
    if (!data.friend && data.user_id)
      Object.defineProperty(data, "friend", {
        value: data.bot.pickFriend(data.user_id),
      })
    if (!data.group && data.group_id)
      Object.defineProperty(data, "group", {
        value: data.bot.pickGroup(data.group_id),
      })
    if (!data.member && data.group && data.user_id)
      Object.defineProperty(data, "member", {
        value: data.group.pickMember(data.user_id),
      })

    if (data.bot.adapter?.id)
      data.adapter_id = data.bot.adapter.id
    if (data.bot.adapter?.name)
      data.adapter_name = data.bot.adapter.name

    for (const i of [data.friend, data.group, data.member]) {
      if (typeof i != "object") continue
      if (!i.sendFile)
        i.sendFile = (file, name) => i.sendMsg(segment.file(file, name))
      if (!i.makeForwardMsg)
        i.makeForwardMsg = this.makeForwardMsg
      if (!i.sendForwardMsg)
        i.sendForwardMsg = msg => this.sendForwardMsg(msg => i.sendMsg(msg), msg)
      if (!i.getInfo)
        i.getInfo = () => i.info || i
    }
  }

  em(name = "", data = {}) {
    this.makeEvent(data)
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
    this.makeLog("error", ["获取用户对象错误：找不到用户", user_id])
  }
  get pickUser() { return this.pickFriend }

  pickGroup(group_id) {
    group_id = Number(group_id) || String(group_id)
    const group = this.gl.get(group_id)
    if (group) return this[group.bot_id].pickGroup(group_id)
    this.makeLog("error", ["获取群对象错误：找不到群", group_id])
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
          resolve(data.bot.pickFriend(user_id).sendMsg(msg))
        )
      )
    } catch (err) {
      this.makeLog("error", [`发送好友消息错误：[${user_id}]`, err], bot_id)
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
          resolve(data.bot.pickGroup(group_id).sendMsg(msg))
        )
      )
    } catch (err) {
      this.makeLog("error", [`发送群消息错误：[${group_id}]`, err], bot_id)
    }
    return false
  }

  getTextMsg(fnc = () => true) {
    if (typeof fnc != "function") {
      const { self_id, user_id } = fnc
      fnc = data => data.self_id == self_id && data.user_id == user_id
    }

    return new Promise(resolve => {
      const listener = data => { try {
        if (!fnc(data)) return

        let msg = ""
        for (const i of data.message)
          if (i.type == "text" && i.text)
            msg += i.text.trim()
        if (!msg) return

        resolve(msg)
        this.off("message", listener)
      } catch (err) {
        this.makeLog("error", err, data.self_id)
      }}
      this.on("message", listener)
    })
  }

  getMasterMsg() {
    return this.getTextMsg(data => cfg.master[data.self_id]?.includes(String(data.user_id)))
  }

  sendMasterMsg(msg, bot_array = Object.keys(cfg.master)) {
    const ret = []
    for (const bot_id of Array.isArray(bot_array) ? bot_array : [bot_array])
      for (const user_id of cfg.master[bot_id] || [])
        ret.push(this.sendFriendMsg(bot_id, user_id, msg))
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
    for (const { message } of msg)
      messages.push(await send(message))
    return messages
  }

  getTimeDiff(time1 = this.stat.start_time, time2 = Date.now()/1000) {
    const time = time2 - time1
    let ret = ""
    const day = Math.floor(time / 3600 / 24)
    if (day) ret += `${day}天`
    const hour = Math.floor((time / 3600) % 24)
    if (hour) ret += `${hour}时`
    const min = Math.floor((time / 60) % 60)
    if (min) ret += `${min}分`
    const sec = Math.floor(time % 60)
    if (sec) ret += `${sec}秒`
    return ret || "0秒"
  }
}