import { randomUUID } from "node:crypto"
import path from "node:path"
import fs from "node:fs"

Bot.adapter.push(new class gocqhttpAdapter {
  constructor() {
    this.id = "QQ"
    this.name = "go-cqhttp"
    this.path = this.name
  }

  makeLog(msg) {
    return Bot.String(msg).replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
  }

  sendApi(ws, action, params) {
    const echo = randomUUID()
    ws.sendMsg({ action, params, echo })
    return new Promise(resolve =>
      Bot.once(echo, data =>
        resolve({ ...data, ...data.data })))
  }

  setProfile(data, profile) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 设置资料：${JSON.stringify(profile)}`)
    return data.bot.sendApi("set_qq_profile", profile)
  }

  makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (let i of msg)
      if (typeof i == "object") {
        switch (i.type) {
          case "button":
            continue
        }

        if (Buffer.isBuffer(i.file))
          i.file = `base64://${i.file.toString("base64")}`

        msgs.push({ type: i.type, data: { ...i, type: undefined }})
      } else {
        msgs.push({ type: "text", data: { text: i }})
      }
    return msgs
  }

  sendFriendMsg(data, msg) {
    if (msg?.type == "node")
      return this.sendFriendForwardMsg(data, msg.data)

    const message = this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友消息：${this.makeLog(message)}`)
    return data.bot.sendApi("send_msg", {
      user_id: data.user_id,
      message,
    })
  }

  sendGroupMsg(data, msg) {
    if (msg?.type == "node")
      return this.sendGroupForwardMsg(data, msg.data)

    const message = this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群消息：${this.makeLog(message)}`)
    return data.bot.sendApi("send_msg", {
      group_id: data.group_id,
      message,
    })
  }

  sendGuildMsg(data, msg) {
    if (msg?.type == "node")
      return Bot.sendForwardMsg(msg => this.sendGuildMsg(data, msg), msg)

    const message = this.makeMsg(msg)
    logger.info(`${logger.blue(`[${data.self_id}] => ${data.guild_id}-${data.channel_id}`)} 发送频道消息：${this.makeLog(message)}`)
    return data.bot.sendApi("send_guild_channel_msg", {
      guild_id: data.guild_id,
      channel_id: data.channel_id,
      message,
    })
  }

  async getMsg(data, message_id) {
    const msg = (await data.bot.sendApi("get_msg", { message_id })).data

    if (msg?.message) {
      const message = []
      for (const i of msg.message)
        message.push({ ...i.data, type: i.type })
      msg.message = message
    }

    return msg
  }

  recallMsg(data, message_id) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${message_id}`)
    return data.bot.sendApi("delete_msg", { message_id })
  }

  getForwardMsg(data, message_id) {
    return data.bot.sendApi("get_forward_msg", { message_id })
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

  async sendFriendForwardMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友转发消息：${this.makeLog(msg)}`)
    msg = await data.bot.sendApi("send_private_forward_msg", {
      user_id: data.user_id,
      messages: this.makeForwardMsg(msg),
    })
    return msg
  }

  async sendGroupForwardMsg(data, msg) {
    logger.info(`${logger.blue(`[${data.self_id} => ${data.group_id}]`)} 发送群转发消息：${this.makeLog(msg)}`)
    msg = await data.bot.sendApi("send_group_forward_msg", {
      group_id: data.group_id,
      messages: this.makeForwardMsg(msg),
    })
    return msg
  }

  async getFriendArray(data) {
    return (await data.bot.sendApi("get_friend_list")).data
  }

  async getFriendList(data) {
    const array = []
    for (const { user_id } of (await this.getFriendArray(data)))
      array.push(user_id)
    return array
  }

  async getFriendMap(data) {
    for (const i of (await this.getFriendArray(data)))
      data.bot.fl.set(i.user_id, i)
    return data.bot.fl
  }

  getFriendInfo(data) {
    return data.bot.sendApi("get_stranger_info", {
      user_id: data.user_id,
    })
  }

  async getGroupArray(data) {
    const array = (await data.bot.sendApi("get_group_list")).data
    for (const guild of (await this.getGuildArray(data)))
      for (const channel of (await this.getGuildChannelArray({
        ...data,
        guild_id: guild.guild_id,
      })))
        array.push({
          guild,
          channel,
          group_id: `${guild.guild_id}-${channel.channel_id}`,
          group_name: `${guild.guild_name}-${channel.channel_name}`,
        })
    return array
  }

  async getGroupList(data) {
    const array = []
    for (const { group_id } of (await this.getGroupArray(data)))
      array.push(group_id)
    return array
  }

  async getGroupMap(data) {
    for (const i of (await this.getGroupArray(data)))
      data.bot.gl.set(i.group_id, i)
    return data.bot.gl
  }

  getGroupInfo(data) {
    return data.bot.sendApi("get_group_info", {
      group_id: data.group_id,
    })
  }

  async getMemberArray(data) {
    return (await data.bot.sendApi("get_group_member_list", {
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
    const map = new Map
    for (const i of (await this.getMemberArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getMemberInfo(data) {
    return data.bot.sendApi("get_group_member_info", {
      group_id: data.group_id,
      user_id: data.user_id,
    })
  }

  async getGuildArray(data) {
    return (await data.bot.sendApi("get_guild_list")).data
  }

  getGuildInfo(data) {
    return data.bot.sendApi("get_guild_meta_by_guest", {
      guild_id: data.guild_id,
    })
  }

  async getGuildChannelArray(data) {
    return (await data.bot.sendApi("get_guild_channel_list", {
      guild_id: data.guild_id,
    })).data
  }

  async getGuildChannelMap(data) {
    const map = new Map
    for (const i of (await this.getGuildChannelArray(data)))
      map.set(i.channel_id, i)
    return map
  }

  async getGuildMemberArray(data) {
    const array = []
    let next_token = ""
    while (true) {
      const list = (await data.bot.sendApi("get_guild_member_list", {
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
    for (const { user_id } of (await this.getGuildMemberArray(data)))
      array.push(user_id)
    return array.push
  }

  async getGuildMemberMap(data) {
    const map = new Map
    for (const i of (await this.getGuildMemberArray(data)))
      map.set(i.user_id, i)
    return map
  }

  getGuildMemberInfo(data) {
    return data.bot.sendApi("get_guild_member_profile", {
      guild_id: data.guild_id,
      user_id: data.user_id,
    })
  }

  setGroupName(data, group_name) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 设置群名：[${data.group_id}] ${group_name}`)
    return data.bot.sendApi("set_group_name", {
      group_id: data.group_id,
      group_name,
    })
  }

  setGroupAvatar(data, file) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 设置群头像：[${data.group_id}] ${file}`)
    return data.bot.sendApi("set_group_portrait", {
      group_id: data.group_id,
      file: segment.image(file).file,
    })
  }

  setGroupAdmin(data, user_id, enable) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} ${enable ? "设置" : "取消"}群管理员：[${data.group_id}] ${user_id}`)
    return data.bot.sendApi("set_group_admin", {
      group_id: data.group_id,
      user_id,
      enable,
    })
  }

  setGroupCard(data, user_id, card) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 设置群名片：[${data.group_id}] ${user_id} ${card}`)
    return data.bot.sendApi("set_group_card", {
      group_id: data.group_id,
      user_id,
      card,
    })
  }

  setGroupTitle(data, user_id, special_title, duration) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 设置群头衔：[${data.group_id}] ${user_id} ${special_title} ${duration}`)
    return data.bot.sendApi("set_group_special_title", {
      group_id: data.group_id,
      user_id,
      special_title,
      duration,
    })
  }

  downloadFile(data, url, thread_count, headers) {
    return data.bot.sendApi("download_file", {
      url,
      thread_count,
      headers,
    })
  }

  async makeFile(data, file, name = path.basename(file)) {
    if (file.match(/^https?:\/\//))
      file = (await this.downloadFile(data, file)).file
    else if (fs.existsSync(file))
      file = path.resolve(file)
    return { file, name }
  }

  async sendFriendFile(data, file, name) {
    logger.info(`${logger.blue(`[${data.self_id} => ${data.user_id}]`)} 发送好友文件：${name}(${file})`)
    return data.bot.sendApi("upload_private_file", {
      user_id: data.user_id,
      ...await this.makeFile(data, file, name),
    })
  }

  async sendGroupFile(data, file, folder, name) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群文件：[${data.group_id}] ${folder||""}/${name}(${file})`)
    return data.bot.sendApi("upload_group_file", {
      group_id: data.group_id,
      folder,
      ...await this.makeFile(data, file, name),
    })
  }

  deleteGroupFile(data, file_id, busid) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 删除群文件：[${data.group_id}] ${file_id}(${busid})`)
    return data.bot.sendApi("delete_group_file", {
      group_id: data.group_id,
      file_id,
      busid,
    })
  }

  createGroupFileFolder(data, name) {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 创建群文件夹：[${data.group_id}] ${name}`)
    return data.bot.sendApi("create_group_file_folder", {
      group_id: data.group_id,
      name,
    })
  }

  getGroupFileSystemInfo(data) {
    return data.bot.sendApi("get_group_file_system_info", {
      group_id: data.group_id,
    })
  }

  getGroupFiles(data, folder_id) {
    if (folder_id)
      return data.bot.sendApi("get_group_files_by_folder", {
        group_id: data.group_id,
        folder_id,
      })
    return data.bot.sendApi("get_group_root_files", {
      group_id: data.group_id,
    })
  }

  getGroupFileUrl(data, file_id, busid) {
    return data.bot.sendApi("get_group_file_url", {
      group_id: data.group_id,
      file_id,
      busid,
    })
  }

  getGroupFs(data) {
    return {
      upload: (file, folder, name) => this.sendGroupFile(data, file, folder, name),
      rm: (file_id, busid) => this.deleteGroupFile(data, file_id, busid),
      mkdir: name => this.createGroupFileFolder(data, name),
      df: () => this.getGroupFileSystemInfo(data),
      ls: folder_id => this.getGroupFiles(data, folder_id),
      download: (file_id, busid) => this.getGroupFileUrl(data, file_id, busid),
    }
  }

  setFriendAddRequest(data, flag, approve, remark) {
    return data.bot.sendApi("set_friend_add_request", {
      flag,
      approve,
      remark,
    })
  }

  setGroupAddRequest(data, flag, sub_type, approve, reason) {
    return data.bot.sendApi("set_group_add_request", {
      flag,
      sub_type,
      approve,
      reason,
    })
  }

  pickFriend(data, user_id) {
    const i = {
      ...data.bot.fl.get(user_id),
      ...data,
      user_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
      getMsg: message_id => this.getMsg(i, message_id),
      recallMsg: message_id => this.recallMsg(i, message_id),
      getForwardMsg: message_id => this.getForwardMsg(i, message_id),
      sendForwardMsg: msg => this.sendFriendForwardMsg(i, msg),
      sendFile: (file, name) => this.sendFriendFile(i, file, name),
      getInfo: () => this.getFriendInfo(i),
      getAvatarUrl: () => `https://q1.qlogo.cn/g?b=qq&s=0&nk=${user_id}`,
    }
  }

  pickMember(data, group_id, user_id) {
    if (typeof group_id == "string" && group_id.match("-")) {
      const guild_id = group_id.split("-")
      const i = {
        ...data,
        guild_id: guild_id[0],
        channel_id: guild_id[1],
        user_id,
      }
      return {
        ...this.pickGroup(i, group_id),
        ...i,
        getInfo: () => this.getGuildMemberInfo(i),
        getAvatarUrl: async () => (await this.getGuildMemberInfo(i)).avatar_url,
      }
    }

    const i = {
      ...data.bot.fl.get(user_id),
      ...data,
      group_id,
      user_id,
    }
    return {
      ...this.pickFriend(i, user_id),
      ...i,
      getInfo: () => this.getMemberInfo(i),
      poke: () => this.sendGroupMsg(i, segment.poke(user_id)),
    }
  }

  pickGroup(data, group_id) {
    if (typeof group_id == "string" && group_id.match("-")) {
      const guild_id = group_id.split("-")
      const i = {
        ...data.bot.gl.get(group_id),
        ...data,
        guild_id: guild_id[0],
        channel_id: guild_id[1],
      }
      return {
        ...i,
        sendMsg: msg => this.sendGuildMsg(i, msg),
        getMsg: message_id => this.getMsg(i, message_id),
        recallMsg: message_id => this.recallMsg(i, message_id),
        getForwardMsg: message_id => this.getForwardMsg(i, message_id),
        getInfo: () => this.getGuildInfo(i),
        getChannelArray: () => this.getGuildChannelArray(i),
        getChannelList: () => this.getGuildChannelList(i),
        getChannelMap: () => this.getGuildChannelMap(i),
        getMemberArray: () => this.getGuildMemberArray(i),
        getMemberList: () => this.getGuildMemberList(i),
        getMemberMap: () => this.getGuildMemberMap(i),
        pickMember: user_id => this.pickMember(i, group_id, user_id),
      }
    }

    const i = {
      ...data.bot.gl.get(group_id),
      ...data,
      group_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendGroupMsg(i, msg),
      getMsg: message_id => this.getMsg(i, message_id),
      recallMsg: message_id => this.recallMsg(i, message_id),
      getForwardMsg: message_id => this.getForwardMsg(i, message_id),
      sendForwardMsg: msg => this.sendGroupForwardMsg(i, msg),
      sendFile: (file, name) => this.sendGroupFile(i, file, undefined, name),
      getInfo: () => this.getGroupInfo(i),
      getAvatarUrl: () => `https://p.qlogo.cn/gh/${group_id}/${group_id}/0`,
      getMemberArray: () => this.getMemberArray(i),
      getMemberList: () => this.getMemberList(i),
      getMemberMap: () => this.getMemberMap(i),
      pickMember: user_id => this.pickMember(i, group_id, user_id),
      pokeMember: user_id => this.sendGroupMsg(i, segment.poke(user_id)),
      setName: group_name => this.setGroupName(i, group_name),
      setAvatar: file => this.setGroupAvatar(i, file),
      setAdmin: (user_id, enable) => this.setGroupAdmin(i, user_id, enable),
      setCard: (user_id, card) => this.setGroupCard(i, user_id, card),
      setTitle: (user_id, special_title, duration) => this.setGroupTitle(i, user_id, special_title, duration),
      fs: this.getGroupFs(i),
    }
  }

  async connect(data, ws) {
    Bot[data.self_id] = {
      adapter: this,
      ws: ws,
      sendApi: (action, params) => this.sendApi(ws, action, params),
      stat: { start_time: data.time },
      model: "TRSS Yunzai ",

      info: {},
      get uin() { return this.info.user_id },
      get nickname() { return this.info.nickname },
      get avatar() { return `https://q1.qlogo.cn/g?b=qq&s=0&nk=${this.uin}` },

      setProfile: profile => this.setProfile(data, profile),
      setNickname: nickname => this.setProfile(data, { nickname }),

      pickFriend: user_id => this.pickFriend(data, user_id),
      get pickUser() { return this.pickFriend },
      getFriendArray: () => this.getFriendArray(data),
      getFriendList: () => this.getFriendList(data),
      getFriendMap: () => this.getFriendMap(data),
      fl: new Map,

      pickMember: (group_id, user_id) => this.pickMember(data, group_id, user_id),
      pickGroup: group_id => this.pickGroup(data, group_id),
      getGroupArray: () => this.getGroupArray(data),
      getGroupList: () => this.getGroupList(data),
      getGroupMap: () => this.getGroupMap(data),
      gl: new Map,
      gml: new Map,

      request_list: [],
      getSystemMsg: () => data.bot.request_list,
      setFriendAddRequest: (flag, approve, remark) => this.setFriendAddRequest(data, flag, approve, remark),
      setGroupAddRequest: (flag, sub_type, approve, reason) => this.setGroupAddRequest(data, flag, sub_type, approve, reason),
    }
    data.bot = Bot[data.self_id]

    if (!Bot.uin.includes(data.self_id))
      Bot.uin.push(data.self_id)

    data.bot.sendApi("_set_model_show", {
      model: data.bot.model,
      model_show: data.bot.model,
    })

    data.bot.info = (await data.bot.sendApi("get_login_info")).data
    data.bot.guild_info = (await data.bot.sendApi("get_guild_service_profile")).data
    data.bot.clients = (await data.bot.sendApi("get_online_clients")).clients
    data.bot.version = {
      ...(await data.bot.sendApi("get_version_info")).data,
      id: this.id,
      name: this.name,
    }

    data.bot.getFriendMap()
    data.bot.getGroupMap()

    logger.mark(`${logger.blue(`[${data.self_id}]`)} ${this.name}(${this.id}) ${data.bot.version.app_full_name} 已连接`)
    Bot.em(`connect.${data.self_id}`, data)
  }

  makeMessage(data) {
    const message = []
    for (const i of data.message)
      message.push({ ...i.data, type: i.type })
    data.message = message

    switch (data.message_type) {
      case "private":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
        break
      case "group":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.sender.card||data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
        break
      case "guild":
        data.message_type = "group"
        data.group_id = `${data.guild_id}-${data.channel_id}`
        logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息：[${data.group_id}, ${data.sender.nickname}(${data.user_id})] ${JSON.stringify(data.message)}`)
        Object.defineProperty(data, "friend", { get() { return this.member || {}}})
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(data.raw)}`)
    }

    Bot.em(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
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
        if (data.user_id == data.self_id)
          data.bot.getGroupMap()
        break
      case "group_decrease":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员减少：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`)
        if (data.user_id == data.self_id)
          data.bot.getGroupMap()
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
        data.bot.getFriendMap()
        break
      case "notify":
        if (data.group_id)
          data.notice_type = "group"
        else
          data.notice_type = "friend"
        switch (data.sub_type) {
          case "poke":
            data.operator_id = data.user_id
            if (data.group_id)
              logger.info(`${logger.blue(`[${data.self_id}]`)} 群戳一戳：[${data.group_id}, ${data.operator_id}=>${data.target_id}]`)
            else
              logger.info(`${logger.blue(`[${data.self_id}]`)} 好友戳一戳：[${data.operator_id}=>${data.target_id}]`)
            break
          case "honor":
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群荣誉：[${data.group_id}, ${data.user_id}] ${data.honor_type}`)
            break
          case "title":
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群头衔：[${data.group_id}, ${data.user_id}] ${data.title}`)
            break
          default:
            logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.magenta(data.raw)}`)
        }
        break
      case "group_card":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 群名片更新：[${data.group_id}, ${data.user_id}] ${data.card_old}=>${data.card_new}`)
        break
      case "offline_file":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 离线文件：[${data.user_id}] ${JSON.stringify(data.file)}`)
        break
      case "client_status":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 客户端${data.online ? "上线" : "下线"}：${JSON.stringify(data.client)}`)
        data.clients = (await data.bot.sendApi("get_online_clients")).clients
        data.bot.clients = data.clients
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
        logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道更新：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${JSON.stringify(data.old_info)}=>${JSON.stringify(data.new_info)}`)
        break
      case "channel_created":
        data.notice_type = "guild_channel_created"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道创建：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${JSON.stringify(data.channel_info)}`)
        data.bot.getGroupMap()
        break
      case "channel_destroyed":
        data.notice_type = "guild_channel_destroyed"
        logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道删除：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${JSON.stringify(data.channel_info)}`)
        data.bot.getGroupMap()
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.magenta(data.raw)}`)
    }

    let notice = data.notice_type.split("_")
    data.notice_type = notice.shift()
    notice = notice.join("_")
    if (notice)
      data.sub_type = notice

    if (data.guild_id && data.channel_id) {
      data.group_id = `${data.guild_id}-${data.channel_id}`
      Object.defineProperty(data, "friend", { get() { return this.member || {}}})
    }

    Bot.em(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
  }

  makeRequest(data) {
    switch (data.request_type) {
      case "friend":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 加好友请求：[${data.user_id}] ${data.comment}(${data.flag})`)
        data.sub_type = "add"
        data.approve = approve => data.bot.setFriendAddRequest(data.flag, approve)
        break
      case "group":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 加群请求：[${data.group_id}, ${data.user_id}] ${data.sub_type} ${data.comment}(${data.flag})`)
        data.approve = approve => data.bot.setGroupAddRequest(data.flag, data.sub_type, approve)
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知请求：${logger.magenta(data.raw)}`)
    }

    data.bot.request_list.push(data)
    Bot.em(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
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

  makeMeta(data, ws) {
    switch (data.meta_event_type) {
      case "heartbeat":
        this.heartbeat(data)
        break
      case "lifecycle":
        this.connect(data, ws)
        break
      default:
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(data.raw)}`)
    }
  }

  message(data, ws) {
    try {
      const raw = Bot.String(data)
      data = JSON.parse(data)
      data.raw = raw
    } catch (err) {
      return logger.error(`解码数据失败：${logger.red(err)}`)
    }

    if (data.post_type) {
      if (data.meta_event_type != "lifecycle" && !Bot.uin.includes(data.self_id)) {
        logger.warn(`${logger.blue(`[${data.self_id}]`)} 找不到对应Bot，忽略消息：${logger.magenta(data.raw)}`)
        return false
      }
      data.bot = Bot[data.self_id]

      switch (data.post_type) {
        case "meta_event":
          this.makeMeta(data, ws)
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
          logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(data.raw)}`)
      }
    } else if (data.echo) {
      Bot.emit(data.echo, data)
    } else {
      logger.warn(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.magenta(data.raw)}`)
    }
  }

  load() {
    if (!Array.isArray(Bot.wsf[this.path]))
      Bot.wsf[this.path] = []
    Bot.wsf[this.path].push((ws, ...args) =>
      ws.on("message", data => this.message(data, ws, ...args))
    )
  }
})