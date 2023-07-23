import "./config/init.js"
import cfg from "./config/config.js"
import PluginsLoader from "./plugins/loader.js"
import ListenerLoader from "./listener/loader.js"
import { EventEmitter } from "events"
import express from "express"
import http from "http"

export default class Yunzai extends EventEmitter {
  constructor() {
    super()
    this.uin = []
    this.adapter = []
    this.express = express()
    this.server = http.createServer(this.express)
    this.wss = {}
    this.server.on("upgrade", (req, socket, head) => {
      const wss = this.wss[req.url.split("/")[1]]
      if (wss) wss.handleUpgrade(req, socket, head, conn => wss.emit("connection", conn, req))
    })
  }

  async run() {
    await import("./plugins/stdin.js")
    await PluginsLoader.load()
    await ListenerLoader.load()
    this.serverLoad()
    this.emit("online", this)
  }

  serverLoad() {
    this.express.use(req => {
      logger.info(`${logger.blue(`[${req.ip}]`)} HTTP ${req.method} 请求：${req.url} ${JSON.stringify(req.rawHeaders)}`)
      req.res.redirect("https://github.com/TimeRainStarSky/Yunzai")
    })

    this.server.listen(cfg.bot.port, () => {
      const host = this.server.address().address
      const port = this.server.address().port
      logger.mark(`启动 HTTP 服务器：${logger.green(`http://[${host}]:${port}`)}`)
      for (const i of Object.keys(this.wss))
        logger.info(`本机 ${i} 连接地址：${logger.blue(`ws://localhost:${port}/${i}`)}`)
    })
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
    const map = new Map()
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].fl || [])
        map.set(id, { ...i, bot_id })
    return map
  }

  get fl() {
    return this.getFriendMap()
  }

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
    const map = new Map()
    for (const bot_id of this.uin)
      for (const [id, i] of this[bot_id].gl || [])
        map.set(id, { ...i, bot_id })
    return map
  }

  get gl() {
    return this.getGroupMap()
  }

  pickUser(user_id) {
    return this.pickFriend(user_id)
  }

  pickFriend(user_id) {
    user_id = Number(user_id) || String(user_id)
    const user = this.fl.get(user_id)
    if (user) return this[user.bot_id].pickFriend(user_id)

    logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
    return false
  }

  pickGroup(group_id) {
    group_id = Number(group_id) || String(group_id)
    const group = this.gl.get(group_id)
    if (group) return this[group.bot_id].pickGroup(group_id)

    logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
    return false
  }

  pickMember(group_id, user_id) {
    const group = this.pickGroup(group_id)
    if (group) return group.pickMember(user_id)

    return false
  }

  sendFriendMsg(bot_id, user_id, msg) {
    try {
      if (!bot_id)
        return this.pickFriend(user_id).sendMsg(msg)

      if (this[bot_id])
        return this[bot_id].pickFriend(user_id).sendMsg(msg)

      return new Promise(resolve =>
        this.once(`connect.${bot_id}`, data =>
          resolve(data.pickFriend(user_id).sendMsg(msg))))
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
          resolve(data.pickGroup(group_id).sendMsg(msg))))
    } catch (err) {
      logger.error(`${logger.blue(`[${bot_id}]`)} 发送群消息失败：[$${group_id}] ${err}`)
    }
    return false
  }

  sendMasterMsg(msg) {
    for (const bot_id in cfg.master)
      for (const user_id of cfg.master[bot_id])
        this.sendFriendMsg(bot_id, user_id, msg)
  }

  async getMasterMsg() {
    while (true) {
      const msg = await new Promise(resolve => {
        this.once("message", data => {
          if (cfg.master[data.self_id]?.includes(String(data.user_id)) && data.message) {
            let msg = ""
            for (let i of data.message)
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

  makeForwardMsg(msg) {
    msg.replace = () => msg
    return { type: "node", data: msg }
  }

  async sendForwardMsg(send, msg) {
    const messages = []
    for (const { message } of msg)
      messages.push(await send(message))
    return messages
  }
}