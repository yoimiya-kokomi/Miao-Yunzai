import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import path from "node:path"
import fs from "node:fs"
import { fileTypeFromBuffer } from "file-type"

Bot.adapter.push(new class ComWeChatAdapter {
  constructor() {
    this.id = "WeChat"
    this.name = "ComWeChat"
    this.path = this.name
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
    return this.toStr(msg).replace(/(base64:\/\/|"type":"data","data":").*?(,|]|")/g, "$1...$2")
  }

  sendApi(ws, action, params = {}) {
    const echo = randomUUID()
    const msg = JSON.stringify({ action, params, echo })
    logger.debug(`发送 API 请求：${logger.cyan(this.makeLog(msg))}`)
    ws.send(msg)
    return new Promise(resolve =>
      Bot.once(echo, data =>
        resolve({ ...data, ...data.data })))
  }

  async fileName(file) {
    try {
      if (file.match(/^base64:\/\//)) {
        const buffer = Buffer.from(file.replace(/^base64:\/\//, ""), "base64")
        const type = await fileTypeFromBuffer(buffer)
        return `${Date.now()}.${type.ext}`
      } else {
        return path.basename(file)
      }
    } catch (err) {
      logger.error(`文件类型检测错误：${logger.red(err)}`)
    }
    return false
  }

  async uploadFile(data, file, name) {
    const opts = { name: name || await this.fileName(file) || randomUUID() }

    if (file.match(/^https?:\/\//)) {
      opts.type = "url"
      opts.url = file
    } else if (file.match(/^base64:\/\//)) {
      opts.type = "data"
      opts.data = file.replace(/^base64:\/\//, "")
    } else if (fs.existsSync(file)) {
      opts.type = "data",
      opts.data = fs.readFileSync(file).toString("base64")
    } else {
      opts.type = "path"
      opts.path = file
    }

    logger.info(`${logger.blue(`[${data.self_id}]`)} 上传文件：${this.makeLog(opts)}`)
    return data.sendApi("upload_file", opts)
  }

  async makeMsg(data, msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", data: { text: i }}
      else if (!i.data)
        i = { type: i.type, data: { ...i, type: undefined }}
      if (i.data.file)
        i.data = { file_id: (await this.uploadFile(data, i.data.file)).file_id }

      switch (i.type) {
        case "text":
          break
        case "image":
          break
        case "record":
          i.type = "file"
          break
        case "video":
          i.type = "file"
          break
        case "at":
          if (i.data.qq == "all")
            i = { type: "mention_all", data: {}}
          else
            i = { type: "mention", data: { user_id: i.data.qq }}
          break
        case "reply":
          continue
          break
        default:
          i = { type: "text", data: { text: JSON.stringify(i) }}
      }
      msgs.push(i)
    }
    return msgs
  }

  async sendFriendMsg(data, msg) {
    if (msg?.type == "node")
      return Bot.sendForwardMsg(msg => this.sendFriendMsg(data, msg), msg.data)

    const message = await this.makeMsg(data, msg)
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${this.makeLog(message)}`)
    return data.sendApi("send_message", {
      detail_type: "private",
      user_id: data.user_id,
      message,
    })
  }

  async sendGroupMsg(data, msg) {
    if (msg?.type == "node")
      return Bot.sendForwardMsg(msg => this.sendGroupMsg(data, msg), msg.data)

    const message = await this.makeMsg(data, msg)
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${this.makeLog(message)}`)
    return data.sendApi("send_message", {
      detail_type: "group",
      group_id: data.group_id,
      message,
    })
  }

  async getFriendArray(data) {
    const array = []
    for (const i of (await data.sendApi("get_friend_list")).data)
      array.push({
        ...i,
        nickname: i.user_remark == "null" ? i.user_displayname || i.user_name : i.user_remark,
      })
    return array
  }

  async getFriendList(data) {
    const array = []
    for (const { user_id } of (await this.getFriendArray(data)))
      array.push(user_id)
    return array
  }

  async getFriendMap(data) {
    const map = new Map()
    for (const i of (await this.getFriendArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getFriendInfo(data) {
    return data.sendApi("get_user_info", {
      user_id: data.user_id,
    })
  }

  async getGroupArray(data) {
    return (await data.sendApi("get_group_list")).data
  }

  async getGroupList(data) {
    const array = []
    for (const { group_id } of (await this.getGroupArray(data)))
      array.push(group_id)
    return array
  }

  async getGroupMap(data) {
    const map = new Map()
    for (const i of (await this.getGroupArray(data)))
      map.set(i.group_id, i)
    return map
  }

  getGroupInfo(data) {
    return data.sendApi("get_group_info", {
      group_id: data.group_id,
    })
  }

  async getMemberArray(data) {
    return (await data.sendApi("get_group_member_list", {
      group_id: data.group_id,
    })).data
  }

  async getMemberList(data) {
    const array = []
    for (const { user_id } of (await this.getMemberArray(data)))
      array.push(user_id)
    return array
  }

  async getMemberMap(data) {
    const map = new Map()
    for (const i of (await this.getMemberArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getMemberInfo(data) {
    return data.sendApi("get_group_member_info", {
      group_id: data.group_id,
      user_id: data.user_id,
    })
  }

  async sendFile(data, send, file, name) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送文件：${name}(${file})`)
    return send(segment.custom("file", {
      file_id: (await this.uploadFile(data, file, name)).file_id
    }))
  }

  pickFriend(data, user_id) {
    const i = {
      ...Bot[data.self_id].fl.get(user_id),
      ...data,
      user_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
      recallMsg: () => false,
      makeForwardMsg: Bot.makeForwardMsg,
      sendForwardMsg: msg => Bot.sendForwardMsg(msg => this.sendFriendMsg(i, msg), msg),
      sendFile: (file, name) => this.sendFile(i, msg => this.sendFriendMsg(i, msg), file, name),
      getInfo: () => this.getFriendInfo(i),
      getAvatarUrl: async () => (await this.getFriendInfo(i))["wx.avatar"],
    }
  }

  pickMember(data, group_id, user_id) {
    const i = {
      ...Bot[data.self_id].fl.get(user_id),
      ...data,
      group_id,
      user_id,
    }
    return {
      ...this.pickFriend(i, user_id),
      ...i,
      getInfo: () => this.getMemberInfo(i),
      getAvatarUrl: async () => (await this.getMemberInfo(i))["wx.avatar"],
    }
  }

  pickGroup(data, group_id) {
    const i = {
      ...Bot[data.self_id].gl.get(group_id),
      ...data,
      group_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendGroupMsg(i, msg),
      recallMsg: () => false,
      makeForwardMsg: Bot.makeForwardMsg,
      sendForwardMsg: msg => Bot.sendForwardMsg(msg => this.sendGroupMsg(i, msg), msg),
      sendFile: (file, name) => this.sendFile(i, msg => this.sendGroupMsg(i, msg), file, name),
      getInfo: () => this.getGroupInfo(i),
      getAvatarUrl: async () => (await this.getGroupInfo(i))["wx.avatar"],
      getMemberArray: () => this.getMemberArray(i),
      getMemberList: () => this.getMemberList(i),
      getMemberMap: () => this.getMemberMap(i),
      pickMember: user_id => this.pickMember(i, i.group_id, user_id),
    }
  }

  async connect(data) {
    for (const bot of data.status.bots)
      data.self_id = bot.self.user_id

    Bot[data.self_id] = {
      adapter: this,
      sendApi: data.sendApi,
      stat: { ...data.status, start_time: data.time },

      pickUser: user_id => this.pickFriend(data, user_id),
      pickFriend: user_id => this.pickFriend(data, user_id),

      getFriendArray: () => this.getFriendArray(data),
      getFriendList: () => this.getFriendList(data),
      getFriendMap: () => this.getFriendMap(data),

      pickMember: (group_id, user_id) => this.pickMember(data, group_id, user_id),
      pickGroup: group_id => this.pickGroup(data, group_id),

      getGroupArray: () => this.getGroupArray(data),
      getGroupList: () => this.getGroupList(data),
      getGroupMap: () => this.getGroupMap(data),
    }

    Bot[data.self_id].info = (await data.sendApi("get_self_info")).data
    Bot[data.self_id].uin = Bot[data.self_id].info.user_id
    Bot[data.self_id].nickname = Bot[data.self_id].info.user_name
    Bot[data.self_id].avatar = Bot[data.self_id].info["wx.avatar"]

    Bot[data.self_id].version = {
      ...(await data.sendApi("get_version")).data,
      id: this.id,
      name: this.name,
    }

    Bot[data.self_id].fl = await Bot[data.self_id].getFriendMap()
    Bot[data.self_id].gl = await Bot[data.self_id].getGroupMap()

    if (!Bot.uin.includes(data.self_id))
      Bot.uin.push(data.self_id)

    logger.mark(`${logger.blue(`[${data.self_id}]`)} ${this.name}(${this.id}) 已连接`)
    Bot.emit(`connect.${data.self_id}`, Bot[data.self_id])
    Bot.emit(`connect`, Bot[data.self_id])
  }

  makeMessage(data) {
    data.post_type = data.type
    data.message_type = data.detail_type
    data.raw_message = data.alt_message

    data.sender = {
      ...data.bot.fl.get(data.user_id),
      user_id: data.user_id,
    }

    const message = []
    for (const i of data.message)
      switch (i.type) {
        case "mention":
          message.push({ type: "at", qq: i.data.user_id })
          break
        case "mention_all":
          message.push({ type: "at", qq: "all" })
          break
        case "voice":
          message.push({ type: "record", ...i.data })
          break
        default:
          message.push({ type: i.type, ...i.data })
      }
    data.message = message

    switch (data.message_type) {
      case "private":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.user_id}] ${data.raw_message}`)
        data.friend = data.bot.pickFriend(data.user_id)
        break
      case "group":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.user_id}] ${data.raw_message}`)
        data.friend = data.bot.pickFriend(data.user_id)
        data.group = data.bot.pickGroup(data.group_id)
        data.member = data.group.pickMember(data.user_id)
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(JSON.stringify(data))}`)
    }

    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  makeMeta(data) {
    switch (data.detail_type) {
      case "heartbeat":
        break
      case "connect":
        break
      case "status_update":
        this.connect(data)
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(JSON.stringify(data))}`)
    }
  }

  message(data, ws) {
    try {
      data = JSON.parse(data)
    } catch (err) {
      return logger.error(`解码数据失败：${logger.red(err)}`)
    }

    if (data.self?.user_id) {
      data.self_id = data.self.user_id
    } else {
      data.self_id = data.id
    }

    if (data.type) {
      if (data.type != "meta" && !Bot.uin.includes(data.self_id)) {
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 找不到对应Bot，忽略消息：${logger.magenta(JSON.stringify(data))}`)
        return false
      }
      data.sendApi = (action, params) => this.sendApi(ws, action, params)
      data.bot = Bot[data.self_id]

      switch (data.type) {
        case "meta":
          this.makeMeta(data)
          break
        case "message":
          this.makeMessage(data)
          break
/*
        case "notice":
          this.makeNotice(data)
          break
        case "request":
          this.makeRequest(data)
          break
*/
        default:
          logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(JSON.stringify(data))}`)
      }
    } else if (data.echo) {
      logger.debug(`请求 API 返回：${logger.cyan(JSON.stringify(data))}`)
      Bot.emit(data.echo, data)
    } else {
      logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(JSON.stringify(data))}`)
    }
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