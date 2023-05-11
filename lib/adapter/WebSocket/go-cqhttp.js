import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"

export default class gocqhttpAdapter {
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
    return this.toStr(msg).replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
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

  makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (const i of msg)
      if (typeof i == "object") {
        if (i.data)
          msgs.push(i)
        else
          msgs.push({ type: i.type, data: { ...i, type: undefined }})
      } else {
        msgs.push({ type: "text", data: { text: i }})
      }
    return msgs
  }

  sendFriendMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${this.makeLog(msg)}`)
    return data.sendApi("send_msg", {
      user_id: data.user_id,
      message: this.makeMsg(msg),
    })
  }

  sendGroupMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${this.makeLog(msg)}`)
    return data.sendApi("send_msg", {
      group_id: data.group_id,
      message: this.makeMsg(msg),
    })
  }

  sendGuildMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：[${data.guild_id}-${data.channel_id}] ${this.makeLog(msg)}`)
    return data.sendApi("send_guild_channel_msg", {
      guild_id: data.guild_id,
      channel_id: data.channel_id,
      message: this.makeMsg(msg),
    })
  }

  getMsg(data, message_id) {
    return data.sendApi("get_msg", { message_id })
  }

  recallMsg(data, message_id) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${message_id}`)
    return data.sendApi("delete_msg", { message_id })
  }

  getForwardMsg(data, message_id) {
    return data.sendApi("get_forward_msg", { message_id })
  }

  makeForwardMsg(msg) {
    const messages = []
    for (const i of msg)
      messages.push({
        type: "node",
        data: {
          name: i.nickname || "匿名消息",
          uin: Number(i.user_id) || 80000000,
          content: this.makeMsg(i.message),
          time: i.time,
        },
      })
    return messages
  }

  async makeFriendForwardMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友转发消息：[${data.user_id}] ${this.makeLog(msg)}`)
    msg = await data.sendApi("send_private_forward_msg", {
      user_id: data.user_id,
      messages: this.makeForwardMsg(msg),
    })
    msg.data = "好友转发消息"
    return msg
  }

  async makeGroupForwardMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群转发消息：[${data.group_id}] ${this.makeLog(msg)}`)
    msg = await data.sendApi("send_group_forward_msg", {
      group_id: data.group_id,
      messages: this.makeForwardMsg(msg),
    })
    msg.data = "群转发消息"
    return msg
  }

  async makeGuildForwardMsg(data, msg) {
    const messages = []
    for (const i of msg)
      messages.push(await this.sendGuildMsg(data, i.message))
    messages.data = "频道消息"
    return messages
  }

  async getFriendArray(data) {
    return (await data.sendApi("get_friend_list")).data
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
    return data.sendApi("get_stranger_info", {
      user_id: data.user_id,
    })
  }

  async getGroupArray(data) {
    const array = (await data.sendApi("get_group_list")).data
    for (const guild of (await this.getGuildArray(data)))
      for (const channel of (await this.getGuildChannelArray({
        ...data,
        guild_id: guild.guild_id,
      })))
        array.push({
          ...guild,
          ...channel,
          group_id: `${guild.guild_id}-${channel.channel_id}`,
          group_name: `${guild.guild_name}-${channel.channel_name}`,
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

  async getGuildArray(data) {
    return (await data.sendApi("get_guild_list")).data
  }

  getGuildInfo(data) {
    return data.sendApi("get_guild_meta_by_guest", {
      guild_id: data.guild_id,
    })
  }

  async getGuildChannelArray(data) {
    return (await data.sendApi("get_guild_channel_list", {
      guild_id: data.guild_id,
    })).data
  }

  async getGuildChannelMap(data) {
    const map = new Map()
    for (const i of (await this.getGuildChannelArray(data)))
      map.set(i.channel_id, i)
    return map
  }

  async getGuildMemberArray(data) {
    const array = []
    let next_token = ""
    while (true) {
      const list = (await data.sendApi("get_guild_member_list", {
        guild_id: data.guild_id,
        next_token,
      })).data

      for (const i of list.members)
        array.push({
          ...i,
          user_id: i.tiny_id,
        })
      if (list.finished) break
      next_token = list.next_token
    }
    return array
  }

  async getGuildMemberList(data) {
    const array = []
    for (const i of (await this.getGuildMemberArray(data)))
      array.push(i.user_id)
    return array.push
  }

  async getGuildMemberMap(data) {
    const map = new Map()
    for (const i of (await this.getGuildMemberArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getGuildMemberInfo(data) {
    return data.sendApi("get_guild_member_profile", {
      guild_id: data.guild_id,
      user_id: data.user_id,
    })
  }

  setGroupName(data, group_name) {
    return data.sendApi("set_group_name", {
      group_id: data.group_id,
      group_name,
    })
  }

  setGroupAvatar(data, file) {
    return data.sendApi("set_group_portrait", {
      group_id: data.group_id,
      file: segment.image(file).data.file,
    })
  }

  setGroupAdmin(data, user_id, enable) {
    return data.sendApi("set_group_admin", {
      group_id: data.group_id,
      user_id,
      enable,
    })
  }

  setGroupCard(data, user_id, card) {
    return data.sendApi("set_group_card", {
      group_id: data.group_id,
      user_id,
      card,
    })
  }

  setGroupTitle(data, user_id, special_title, duration) {
    return data.sendApi("set_group_special_title", {
      group_id: data.group_id,
      user_id,
      special_title,
      duration,
    })
  }

  async connect(data) {
    Bot[data.self_id] = {
      sendApi: data.sendApi,
      stat: { start_time: data.time },

      getMsg: message_id => this.getMsg(data, message_id),
      recallMsg: message_id => this.recallMsg(data, message_id),
      getForwardMsg: message_id => this.getForwardMsg(data, message_id),

      pickFriend: user_id => {
        const i = { ...data, user_id }
        return {
          sendMsg: msg => this.sendFriendMsg(i, msg),
          recallMsg: message_id => this.recallMsg(i, message_id),
          makeForwardMsg: msg => this.makeFriendForwardMsg(i, msg),
          getInfo: () => this.getFriendInfo(i),
          getAvatarUrl: () => `https://q1.qlogo.cn/g?b=qq&s=0&nk=${i.user_id}`,
        }
      },

      getFriendArray: () => this.getFriendArray(data),
      getFriendList: () => this.getFriendList(data),
      getFriendMap: () => this.getFriendMap(data),

      pickMember: (group_id, user_id) => {
        if (typeof group_id == "string" && group_id.match("-")) {
          group_id = group_id.split("-")
          const i = { ...data, guild_id: group_id[0], channel_id: group_id[1], user_id }
          return {
            ...Bot[data.self_id].pickGroup(`${i.guild_id}-${i.channel_id}`),
            getInfo: () => this.getGuildMemberInfo(i),
            getAvatarUrl: async () => (await this.getGuildMemberInfo(i)).avatar_url,
          }
        } else {
          const i = { ...data, group_id, user_id }
          return {
            ...Bot[data.self_id].pickFriend(i.user_id),
            getInfo: () => this.getGroupMemberInfo(i),
            poke: () => this.sendGroupMsg(i, segment.poke(i.user_id)),
          }
        }
      },

      pickGroup: group_id => {
        if (typeof group_id == "string" && group_id.match("-")) {
          group_id = group_id.split("-")
          const i = { ...data, guild_id: group_id[0], channel_id: group_id[1] }
          return {
            sendMsg: msg => this.sendGuildMsg(i, msg),
            recallMsg: message_id => this.recallMsg(i, message_id),
            makeForwardMsg: msg => this.makeGuildForwardMsg(i, msg),
            getInfo: () => this.getGuildInfo(i),
            getChannelArray: () => this.getGuildChannelArray(i),
            getChannelList: () => this.getGuildChannelList(i),
            getChannelMap: () => this.getGuildChannelMap(i),
            getMemberArray: () => this.getGuildMemberArray(i),
            getMemberList: () => this.getGuildMemberList(i),
            getMemberMap: () => this.getGuildMemberMap(i),
            pickMember: user_id => Bot[data.self_id].pickMember(`${i.guild_id}-${i.channel_id}`, user_id),
          }
        }

        const i = { ...data, group_id }
        return {
          sendMsg: msg => this.sendGroupMsg(i, msg),
          recallMsg: message_id => this.recallMsg(i, message_id),
          makeForwardMsg: msg => this.makeGroupForwardMsg(i, msg),
          getInfo: () => this.getGroupInfo(i),
          getAvatarUrl: () => `https://p.qlogo.cn/gh/${i.group_id}/${i.group_id}/0`,
          getMemberArray: () => this.getGroupMemberArray(i),
          getMemberList: () => this.getGroupMemberList(i),
          getMemberMap: () => this.getGroupMemberMap(i),
          pickMember: user_id => Bot[data.self_id].pickMember(i.group_id, user_id),
          pokeMember: user_id => this.sendGroupMsg(i, segment.poke(user_id)),
          setName: group_name => this.setGroupName(i, group_name),
          setAvatar: file => this.setGroupAvatar(i, file),
          setAdmin: (user_id, enable) => this.setGroupAdmin(i, user_id, enable),
          setCard: (user_id, card) => this.setGroupCard(i, user_id, card),
          setTitle: (user_id, special_title, duration) => this.setGroupTitle(i, user_id, special_title, duration),
        }
      },

      getGroupArray: () => this.getGroupArray(data),
      getGroupList: () => this.getGroupList(data),
      getGroupMap: () => this.getGroupMap(data),
    }
    Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend

    Bot[data.self_id].info = (await data.sendApi("get_login_info")).data
    Bot[data.self_id].uin = Bot[data.self_id].info.user_id
    Bot[data.self_id].nickname = Bot[data.self_id].info.nickname
    Bot[data.self_id].avatar = Bot[data.self_id].pickFriend(data.self_id).getAvatarUrl()

    Bot[data.self_id].guild_info = (await data.sendApi("get_guild_service_profile")).data
    Bot[data.self_id].tiny_id = Bot[data.self_id].guild_info.tiny_id
    Bot[data.self_id].guild_nickname = Bot[data.self_id].guild_info.nickname

    Bot[data.self_id].model = "TRSS Yunzai "
    data.sendApi("_set_model_show", {
      model: Bot[data.self_id].model,
      model_show: Bot[data.self_id].model,
    })

    Bot[data.self_id].clients = (await data.sendApi("get_online_clients")).clients
    Bot[data.self_id].version = (await data.sendApi("get_version_info")).data
    Bot[data.self_id].version = {
      ...Bot[data.self_id].version,
      impl: Bot[data.self_id].version.app_name,
      version: Bot[data.self_id].version.app_version,
      onebot_version: Bot[data.self_id].version.protocol_version,
    }
    Bot[data.self_id].status = Bot[data.self_id].version.protocol_name

    Bot[data.self_id].fl = await this.getFriendMap(data)
    Bot[data.self_id].gl = await this.getGroupMap(data)

    if (Array.isArray(Bot.uin)) {
      if (!Bot.uin.includes(data.self_id))
        Bot.uin.push(data.self_id)
    } else {
      Bot.uin = [data.self_id]
    }

    logger.mark(`${logger.blue(`[${data.self_id}]`)} go-cqhttp 已连接`)
    Bot.emit(`connect.${data.self_id}`, Bot[data.self_id])
    Bot.emit(`connect`, Bot[data.self_id])
  }

  makeMessage(data) {
    const message = []
    for (const i of data.message)
      message.push({ type: i.type, ...i.data })
    data.message = message

    switch (data.message_type) {
      case "private":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
        data.friend = data.bot.pickFriend(data.user_id)
        break
      case "group":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.sender.card||data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
        data.friend = data.bot.pickFriend(data.user_id)
        data.group = data.bot.pickGroup(data.group_id)
        data.member = data.group.pickMember(data.user_id)
        break
      case "guild":
        data.message_type = "group"
        data.group_id = `${data.guild_id}-${data.channel_id}`
        logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息：[${data.group_id}, ${data.sender.nickname}(${data.user_id})] ${JSON.stringify(data.message)}`)
        data.group = data.bot.pickGroup(data.group_id)
        data.member = data.group.pickMember(data.user_id)
        data.friend = data.member
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
    }

    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  async makeNotice(data) {
    switch (data.notice_type) {
      case "friend_recall":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息撤回：[${data.user_id}] ${data.message_id}`)
        break
      case "group_recall":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息撤回：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.message_id}`)
        break
      case "group_increase":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员增加：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`)
        Bot[data.self_id].gl = await this.getGroupMap(data)
        break
      case "group_decrease":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员减少：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`)
        const gld = new Map()
        Bot[data.self_id].gl = await this.getGroupMap(data)
        break
      case "group_admin":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群管理员变动：[${data.group_id}, ${data.user_id}] ${data.sub_type}`)
        data.set = data.sub_type == "set"
        break
      case "group_upload":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群文件上传：[${data.group_id}, ${data.user_id}] ${JSON.stringify(data.file)}`)
        break
      case "group_ban":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群禁言：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type} ${data.duration}秒`)
        break
      case "friend_add":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 好友添加：[${data.user_id}]`)
        Bot[data.self_id].fl = await this.getFriendMap(data)
        break
      case "notify":
        if (data.group_id)
          data.notice_type = "group"
        else
          data.notice_type = "friend"
        switch (data.sub_type) {
          case "poke":
            if (data.group_id)
              logger.info(`${logger.blue(`[${data.self_id}]`)} 群戳一戳：[${data.group_id}, ${data.user_id}=>${data.target_id}]`)
            else
              logger.info(`${logger.blue(`[${data.self_id}]`)} 好友戳一戳：[${data.user_id}=>${data.target_id}]`)
            data.operator_id = data.user_id
            break
          case "honor":
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群荣誉：[${data.group_id}, ${data.user_id}] ${data.honor_type}`)
            break
          case "title":
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群头衔：[${data.group_id}, ${data.user_id}] ${data.title}`)
            break
          default:
            logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`)
        }
        break
      case "group_card":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群名片更新：[${data.group_id}, ${data.user_id}] ${data.card_old}=>${data.card_new}`)
        break
      case "offline_file":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 离线文件：[${data.user_id}] ${JSON.stringify(data.file)}`)
        break
      case "client_status":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 客户端：[${data.client}] ${data.online ? "上线" : "下线"}`)
        data.clients = (await data.sendApi("get_online_clients")).clients
        Bot[data.self_id].clients = data.clients
        break
      case "essence":
        data.notice_type = "group_essence"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群精华消息：[${data.group_id}, ${data.operator_id}=>${data.sender_id}] ${data.sub_type} ${data.message_id}`)
        break
      case "guild_channel_recall":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息撤回：[${data.guild_id}-${data.channel_id}, ${data.operator_id}=>${data.user_id}] ${data.message_id}`)
        break
      case "message_reactions_updated":
        data.notice_type = "guild_message_reactions_updated"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息表情贴：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.message_id} ${JSON.stringify(data.current_reactions)}`)
        break
      case "channel_updated":
        data.notice_type = "guild_channel_updated"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道更新：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.old_info}=>${data.new_info}`)
        break
      case "channel_created":
        data.notice_type = "guild_channel_created"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道创建：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.channel_info}`)
        Bot[data.self_id].gl = await this.getGroupMap(data)
        break
      default:
        logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`)
    }

    let notice = data.notice_type.split("_")
    data.notice_type = notice.shift()
    notice = notice.join("_")
    if (notice)
      data.sub_type = notice

    if (data.user_id)
      data.friend = data.bot.pickFriend(data.user_id)
    if (data.group_id) {
      data.group = data.bot.pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
    } else if (data.guild_id && data.channel_id){
      data.group_id = `${data.guild_id}-${data.channel_id}`
      data.group = data.bot.pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
      data.friend = data.member
    }

    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.notice_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  makeRequest(data) {
    switch (data.request_type) {
      case "friend":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 加好友请求：[${data.user_id}] ${data.comment} ${data.flag}`)
        data.friend = data.bot.pickFriend(data.user_id)
        break
      case "group":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 加群请求：[${data.group_id}, ${data.user_id}] ${data.sub_type} ${data.comment} ${data.flag}`)
        data.friend = data.bot.pickFriend(data.user_id)
        data.group = data.bot.pickGroup(data.group_id)
        data.member = data.group.pickMember(data.user_id)
        break
      default:
        logger.info(`${logger.blue(`[${data.self_id}]`)} 未知请求：${logger.red(JSON.stringify(data))}`)
    }

    if (data.sub_type)
      Bot.emit(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
    Bot.emit(`${data.post_type}.${data.request_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  heartbeat(data) {
    if (data.status?.stat)
      data.bot.stat = {
        ...data.status,
        lost_pkt_cnt: data.status.stat.packet_lost,
        lost_times: data.status.stat.lost_times,
        recv_msg_cnt: data.status.stat.message_received,
        recv_pkt_cnt: data.status.stat.packet_received,
        sent_msg_cnt: data.status.stat.message_sent,
        sent_pkt_cnt: data.status.stat.packet_sent,
        start_time: data.bot.stat.start_time,
      }
  }

  makeMeta(data) {
    switch (data.meta_event_type) {
      case "heartbeat":
        this.heartbeat(data)
        break
      case "lifecycle":
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

    if (data.post_type) {
      data.sendApi = (action, params) => this.sendApi(ws, action, params)
      data.bot = Bot[data.self_id]
      switch (data.post_type) {
        case "meta_event":
          this.makeMeta(data)
          break
        case "message":
          this.makeMessage(data)
          break
        case "notice":
          this.makeNotice(data)
          break
        case "request":
          this.makeRequest(data)
          break
        case "message_sent":
          data.post_type = "message"
          this.makeMessage(data)
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