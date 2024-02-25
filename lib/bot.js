import "./config/init.js"
import cfg from "./config/config.js"
import PluginsLoader from "./plugins/loader.js"
import ListenerLoader from "./listener/loader.js"
import { EventEmitter } from "events"
import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import _ from "lodash"
import fs from "node:fs/promises"
import path from "node:path"
import util from "node:util"
import fetch from "node-fetch"
import { randomUUID } from "node:crypto"
import { exec } from "child_process"
import { fileTypeFromBuffer } from "file-type"
import md5 from "md5"

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
      this.makeLog("mark", ["HTTP", req.method, "请求", req.headers, req.query, req.body], `${req.ip} => http://${req.headers.host}${req.originalUrl}`)
      req.next()
    })
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
      this.makeLog("mark", ["建立连接", req.headers], `${conn.id} <=> ws://${req.headers.host}${req.url}`)
      conn.on("error", (...args) => this.makeLog("error", args, `${conn.id} <=> ws://${req.headers.host}${req.url}`))
      conn.on("close", () => this.makeLog("mark", "断开连接", `${conn.id} <≠> ws://${req.headers.host}${req.url}`))
      conn.on("message", msg => this.makeLog("debug", ["消息", this.String(msg)], `${conn.id} => ws://${req.headers.host}${req.url}`))
      conn.sendMsg = msg => {
        if (!Buffer.isBuffer(msg)) msg = this.String(msg)
        this.makeLog("debug", ["消息", msg], `${conn.id} <= ws://${req.headers.host}${req.url}`)
        return conn.send(msg)
      }
      for (const i of this.wsf[req.url.split("/")[1]] || [])
        i(conn, req, socket, head)
    })
  }

  serverLoad() {
    this.express.use(req => req.res.redirect("https://github.com/TimeRainStarSky/Yunzai"))
    this.server.listen(cfg.bot.port, () => {
      this.makeLog("mark", `启动 HTTP 服务器：${logger.green(`http://[${this.server.address().address}]:${this.server.address().port}`)}`)
      const url = cfg.bot.url.replace(/^http/, "ws")
      for (const i of Object.keys(this.wsf))
        this.makeLog("info", `连接地址：${logger.blue(`${url}/${i}`)}`, i)
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

  async fsStat(path) { try {
    const stat = await fs.stat(path)
    return stat
  } catch (err) {
    this.makeLog("trace", ["获取", path, "状态错误", err])
    return false
  }}

  async mkdir(dir) { try {
    if (await this.fsStat(dir)) return true
    if (!await this.mkdir(path.dirname(dir))) return false
    await fs.mkdir(dir)
    return true
  } catch (err) {
    this.makeLog("error", ["创建", dir, "错误", err])
    return false
  }}

  async rmdir(dir) { try {
    if (!await this.fsStat(dir)) return true
    for (const i of await fs.readdir(dir))
      await this.rm(`${dir}/${i}`)
    await fs.rmdir(dir)
    return true
  } catch (err) {
    this.makeLog("error", ["删除", dir, "错误", err])
    return false
  }}

  async rm(file) { try {
    const stat = await this.fsStat(file)
    if (!stat) return true
    if (stat.isDirectory())
      return this.rmdir(file)
    await fs.unlink(file)
    return true
  } catch (err) {
    this.makeLog("error", ["删除", file, "错误", err])
    return false
  }}

  async makeMap(dir, map) {
    await this.rm(dir)
    await this.mkdir(dir)
    for (const i of map.keys()) {
      const path = `${dir}/${i}`
      const value = map.get(i)
      try {
        if (value instanceof Map)
          await this.makeMap(path, value)
        else
          await fs.writeFile(path, JSON.stringify(value), "utf-8")
      } catch (err) {
        this.makeLog("error", ["写入", path, "错误", value, err])
      }
    }
    const set = map.set.bind(map)
    map.set = (key, value) => this.setMap(dir, map, set, key, value)
    const del = map.delete.bind(map)
    map.delete = key => this.delMap(dir, map, del, key)
    return map
  }

  async setMap(dir, map, set, key, value) {
    const ret = set(key, value)
    if (JSON.stringify(map.get(key)) == JSON.stringify(value))
      return map
    const path = `${dir}/${key}`
    try {
      if (value instanceof Map)
        await this.makeMap(path, value)
      else
        await fs.writeFile(path, JSON.stringify(value), "utf-8")
    } catch (err) {
      this.makeLog("error", ["写入", path, "错误", value, err])
    }
    return ret
  }

  async delMap(dir, map, del, key) {
    const ret = del(key)
    await this.rm(`${dir}/${key}`)
    return ret
  }

  async getMap(dir) {
    await this.mkdir(dir)
    const map = new Map()
    for (const i of await fs.readdir(dir)) {
      const path = `${dir}/${i}`
      try {
        map.set(i, (await this.fsStat(path)).isDirectory() ?
          await this.getMap(path) :
          JSON.parse(await fs.readFile(path, "utf-8")))
      } catch (err) {
        this.makeLog("error", ["获取", path, "列表错误", err])
        await this.rm(path)
      }
    }
    const set = map.set.bind(map)
    map.set = (key, value) => this.setMap(dir, map, set, key, value)
    const del = map.delete.bind(map)
    map.delete = key => this.delMap(dir, map, del, key)
    return map
  }

  String(data) {
    switch (typeof data) {
      case "string":
        return data
      case "object":
        if (util.isError(data))
          return data.stack
        if (Buffer.isBuffer(data))
          return String(data)
    }
    return JSON.stringify(data)
  }

  Loging(data) {
    if (typeof data == "string") return data
    if (!cfg.bot.log_object && typeof data == "object")
      if (typeof data.toString == "function")
        return String(data)
      else
        return "[object null]"

    return util.inspect(data, {
      depth: null,
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

    if (data.match(/^base64:\/\//)) {
      return Buffer.from(data.replace(/^base64:\/\//, ""), "base64")
    } else if (data.match(/^https?:\/\//)) {
      if (opts.http) return data
      return Buffer.from(await (await fetch(data)).arrayBuffer())
    } else if (await this.fsStat(data.replace(/^file:\/\//, ""))) {
      if (opts.file) return data
      return Buffer.from(await fs.readFile(data.replace(/^file:\/\//, "")))
    }
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
      if (file.times > 0) file.times = file.times-1
      else file = this.fs.timeout
    }

    if (file.type?.mime)
      req.res.setHeader("Content-Type", file.type.mime)

    this.makeLog("mark", `发送文件：${file.name}(${file.url} ${(file.buffer.length/1024).toFixed(2)}KB)`, `${req.ip} <= http://${req.headers.host}/File/${url}`)
    req.res.send(file.buffer)
  }

  async exec(cmd) {
    return new Promise(resolve => {
      this.makeLog("mark", `[命令执行开始] ${logger.blue(cmd)}`)
      exec(cmd, (error, stdout, stderr) => {
        this.makeLog("mark", `[命令执行完成] ${logger.blue(cmd)}${stdout?`\n${String(stdout).trim()}`:""}${stderr?logger.red(`\n${String(stderr).trim()}`):""}`)
        if (error) this.makeLog("error", `[命令执行错误] ${logger.blue(cmd)}\n${logger.red(this.Loging(error).trim())}`)
        resolve({ error, stdout, stderr })
      })
    })
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
        i.getInfo = () => i
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
          resolve(data.bot.pickFriend(user_id).sendMsg(msg))))
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
          resolve(data.bot.pickGroup(group_id).sendMsg(msg))))
    } catch (err) {
      this.makeLog("error", [`发送群消息错误：[${group_id}]`, err], bot_id)
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