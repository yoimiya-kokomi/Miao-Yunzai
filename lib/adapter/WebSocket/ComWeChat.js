import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"

export default class ComWeChatAdapter {
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
  }

  makeLog(msg) {
    return this.toStr(msg).replace(/(base64:\/\/|"type":"data","data":").*?(,|]|")/g, "$1...$2")
  }

  sendApi(ws, action, params) {
    const echo = randomUUID()
    const msg = JSON.stringify({ action, params, echo })
    logger.debug(`发送 API 请求：${logger.cyan(this.makeLog(msg))}`)
    ws.send(msg)
    return new Promise(resolve =>
      Bot.once(echo, data =>
        resolve({ ...data, ...data.data })))
  }

  uploadFile(data, file) {
    return data.sendApi("upload_file", {
      type: "data",
      data: file.replace(/^base64:\/\//, ""),
      name: randomUUID(),
    })
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
        case "at":
          if (i.data.qq == "all")
            msgs.push({ type: "mention_all", data: {}})
          else
            msgs.push({ type: "mention", data: { user_id: i.data.qq }})
          break
        case "reply":
          break
        default:
          msgs.push(i)
      }
    }
    return msgs
  }

  async sendFriendMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${this.makeLog(msg)}`)
    return data.sendApi("send_message", {
      detail_type: "private",
      user_id: data.user_id,
      message: await this.makeMsg(data, msg),
    })
  }

  async sendGroupMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${this.makeLog(msg)}`)
    return data.sendApi("send_message", {
      detail_type: "group",
      group_id: data.group_id,
      message: await this.makeMsg(data, msg),
    })
  }

  async makeForwardMsg(send, msg) {
    const messages = []
    for (const i of msg)
      messages.push(await send(i.message))
    messages.data = "消息"
    return messages
  }

  async getFriendArray(data) {
    const array = []
    for (const i of (await data.sendApi("get_friend_list", {})).data.filter(item => !item.user_id?.endsWith("@chatroom")))
      array.push({
        ...i,
        nickname: i.user_remark == "null" ? i.user_displayname || i.user_name : i.user_remark,
      })
    return array
  }

  async getFriendList(data) {
    const array = []
    for (const i of (await this.getFriendArray(data)))
      array.push(i.user_id)
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
    const array = (await data.sendApi("get_group_list", {})).data
    for (const i of (await data.sendApi("get_friend_list", {})).data.filter(item => item.user_id?.endsWith("@chatroom")))
      array.push({
        group_id: i.user_id,
        group_name: i.user_remark == "null" ? i.user_displayname || i.user_name : i.user_remark,
      })
    return array
  }

  async getGroupList(data) {
    const array = []
    for (const i of (await this.getGroupArray(data)))
      array.push(i.group_id)
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

  async getGroupMemberArray(data) {
    return (await data.sendApi("get_group_member_list", {
      group_id: data.group_id,
    })).data
  }

  async getGroupMemberList(data) {
    const array = []
    for (const i of (await this.getGroupMemberArray(data)))
      array.push(i.user_id)
    return array
  }

  async getGroupMemberMap(data) {
    const map = new Map()
    for (const i of (await this.getGroupMemberArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getGroupMemberInfo(data) {
    return data.sendApi("get_group_member_info", {
      group_id: data.group_id,
      user_id: data.user_id,
    })
  }

  async connect(data) {
    const status = await data.sendApi("get_status", {})
    for (const bot of status.bots)
      data.self_id = bot.self.user_id

    Bot[data.self_id] = {
      sendApi: data.sendApi,
      version: data.version,
      stat: { start_time: data.time },

      pickFriend: user_id => {
        const i = { ...data, user_id }
        return {
          sendMsg: msg => this.sendFriendMsg(i, msg),
          recallMsg: () => false,
          makeForwardMsg: msg => this.makeForwardMsg(msg => this.sendFriendMsg(i, msg), msg),
          getInfo: () => this.getFriendInfo(i),
          getAvatarUrl: async () => (await this.getFriendInfo(i))["wx.avatar"],
        }
      },

      getFriendArray: () => this.getFriendArray(data),
      getFriendList: () => this.getFriendList(data),
      getFriendMap: () => this.getFriendMap(data),

      pickMember: (group_id, user_id) => {
        const i = { ...data, group_id, user_id }
        return {
          ...Bot[data.self_id].pickFriend(user_id),
          getInfo: () => this.getGroupMemberInfo(i),
          getAvatarUrl: async () => (await this.getGroupMemberInfo(i))["wx.avatar"],
        }
      },

      pickGroup: group_id => {
        const i = { ...data, group_id }
        return {
          sendMsg: msg => this.sendGroupMsg(i, msg),
          recallMsg: () => false,
          makeForwardMsg: msg => this.makeForwardMsg(msg => this.sendGroupMsg(i, msg), msg),
          getInfo: () => this.getGroupInfo(i),
          getAvatarUrl: async () => (await this.getGroupInfo(i))["wx.avatar"],
          getMemberArray: () => this.getGroupMemberArray(i),
          getMemberList: () => this.getGroupMemberList(i),
          getMemberMap: () => this.getGroupMemberMap(i),
          pickMember: user_id => Bot[data.self_id].pickMember(i.group_id, user_id),
        }
      },

      getGroupArray: () => this.getGroupArray(data),
      getGroupList: () => this.getGroupList(data),
      getGroupMap: () => this.getGroupMap(data),
    }
    Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend

    Bot[data.self_id].info = (await data.sendApi("get_self_info", {})).data
    Bot[data.self_id].uin = Bot[data.self_id].info.user_id
    Bot[data.self_id].nickname = Bot[data.self_id].info.user_name
    Bot[data.self_id].avatar = Bot[data.self_id].info["wx.avatar"]

    Bot[data.self_id].fl = await this.getFriendMap(data)
    Bot[data.self_id].gl = await this.getGroupMap(data)

    if (Array.isArray(Bot.uin)) {
      if (!Bot.uin.includes(data.self_id))
        Bot.uin.push(data.self_id)
    } else {
      Bot.uin = [data.self_id]
    }

    logger.mark(`${logger.blue(`[${data.self_id}]`)} ComWeChat 已连接`)
    Bot.emit(`connect.${data.self_id}`, Bot[data.self_id])
    Bot.emit(`connect`, Bot[data.self_id])
  }

  makeMessage(data) {
    data.post_type = data.type
    data.message_type = data.detail_type
    data.raw_message = data.alt_message

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
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
    }

    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  makeMeta(data) {
    switch (data.detail_type) {
      case "connect":
        this.connect(data)
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
    }
  }

  message(data, ws) {
    try {
      data = JSON.parse(data)
    } catch (err) {
      return logger.error(err)
    }

    if (data.detail_type == "heartbeat") return

    data.sendApi = (action, params) => this.sendApi(ws, action, params)
    if (data.self?.user_id) {
      data.self_id = data.self.user_id
      data.bot = Bot[data.self_id]
    } else {
      data.self_id = data.id
    }

    if (data.type) {
      switch (data.type) {
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
        case "meta":
          this.makeMeta(data)
          break
        default:
          logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
      }
    } else if (data.echo) {
      logger.debug(`请求 API 返回：${logger.cyan(JSON.stringify(data))}`)
      Bot.emit(data.echo, data)
    } else {
      logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
    }
  }

  load() {
    const wss = new WebSocketServer({ noServer: true })
    wss.on("connection", ws => {
      ws.on("error", logger.error)
      ws.on("message", data => this.message(data, ws))
    })
    return wss
  }
}