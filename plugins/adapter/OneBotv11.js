import path from "node:path"
import { ulid } from "ulid"

Bot.adapter.push(new class OneBotv11Adapter {
  constructor() {
    this.id = "QQ"
    this.name = "OneBotv11"
    this.path = this.name
    this.echo = {}
    this.timeout = 60000
  }

  makeLog(msg) {
    return Bot.String(msg).replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
  }

  sendApi(data, ws, action, params = {}) {
    const echo = ulid()
    const request = { action, params, echo }
    ws.sendMsg(request)
    const error = Error()
    return new Promise((resolve, reject) =>
      this.echo[echo] = {
        request, resolve, reject, error,
        timeout: setTimeout(() => {
          reject(Object.assign(error, request, { timeout: this.timeout }))
          delete this.echo[echo]
          Bot.makeLog("error", ["请求超时", request], data.self_id)
          ws.terminate()
        }, this.timeout),
      }
    )
  }

  async makeFile(file, opts) {
    file = await Bot.Buffer(file, {
      http: true, size: 10485760, ...opts,
    })
    if (Buffer.isBuffer(file))
      return `base64://${file.toString("base64")}`
    return file
  }

  async makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    const forward = []
    for (let i of msg) {
      if (typeof i !== "object")
        i = { type: "text", data: { text: i }}
      else if (!i.data)
        i = { type: i.type, data: { ...i, type: undefined }}

      switch (i.type) {
        case "at":
          i.data.qq = String(i.data.qq)
          break
        case "reply":
          i.data.id = String(i.data.id)
          break
        case "button":
          continue
        case "node":
          forward.push(...i.data)
          continue
        case "raw":
          i = i.data
          break
      }

      if (i.data.file)
        i.data.file = await this.makeFile(i.data.file)

      msgs.push(i)
    }
    return [msgs, forward]
  }

  async sendMsg(msg, send, sendForwardMsg) {
    const [message, forward] = await this.makeMsg(msg)
    const ret = []

    if (forward.length) {
      const data = await sendForwardMsg(forward)
      if (Array.isArray(data))
        ret.push(...data)
      else
        ret.push(data)
    }

    if (message.length)
      ret.push(await send(message))
    if (ret.length === 1) return ret[0]

    const message_id = []
    for (const i of ret) if (i?.message_id)
      message_id.push(i.message_id)
    return { data: ret, message_id }
  }

  sendFriendMsg(data, msg) {
    return this.sendMsg(msg, message => {
      Bot.makeLog("info", `发送好友消息：${this.makeLog(message)}`, `${data.self_id} => ${data.user_id}`, true)
      return data.bot.sendApi("send_msg", {
        user_id: data.user_id,
        message,
      })
    }, msg => this.sendFriendForwardMsg(data, msg))
  }

  sendGroupMsg(data, msg) {
    return this.sendMsg(msg, message => {
      Bot.makeLog("info", `发送群消息：${this.makeLog(message)}`, `${data.self_id} => ${data.group_id}`, true)
      return data.bot.sendApi("send_msg", {
        group_id: data.group_id,
        message,
      })
    }, msg => this.sendGroupForwardMsg(data, msg))
  }

  sendGuildMsg(data, msg) {
    return this.sendMsg(msg, message => {
      Bot.makeLog("info", `发送频道消息：${this.makeLog(message)}`, `${data.self_id}] => ${data.guild_id}-${data.channel_id}`, true)
      return data.bot.sendApi("send_guild_channel_msg", {
        guild_id: data.guild_id,
        channel_id: data.channel_id,
        message,
      })
    }, msg => Bot.sendForwardMsg(msg => this.sendGuildMsg(data, msg), msg))
  }

  async recallMsg(data, message_id) {
    Bot.makeLog("info", `撤回消息：${message_id}`, data.self_id)
    if (!Array.isArray(message_id))
      message_id = [message_id]
    const msgs = []
    for (const i of message_id)
      msgs.push(await data.bot.sendApi("delete_msg", { message_id: i }).catch(i => i))
    return msgs
  }

  parseMsg(msg) {
    const array = []
    for (const i of Array.isArray(msg) ? msg : [msg])
      if (typeof i === "object")
        array.push({ ...i.data, type: i.type })
      else
        array.push({ type: "text", text: String(i) })
    return array
  }

  async getMsg(data, message_id) {
    const msg = (await data.bot.sendApi("get_msg", { message_id })).data
    if (msg?.message)
      msg.message = this.parseMsg(msg.message)
    return msg
  }

  async getFriendMsgHistory(data, message_seq, count) {
    const msgs = (await data.bot.sendApi("get_friend_msg_history", {
      user_id: data.user_id,
      message_seq,
      count,
    })).data?.messages

    for (const i of Array.isArray(msgs) ? msgs : [msgs])
      if (i?.message)
        i.message = this.parseMsg(i.message)
    return msgs
  }

  async getGroupMsgHistory(data, message_seq, count) {
    const msgs = (await data.bot.sendApi("get_group_msg_history", {
      group_id: data.group_id,
      message_seq,
      count,
    })).data?.messages

    for (const i of Array.isArray(msgs) ? msgs : [msgs])
      if (i?.message)
        i.message = this.parseMsg(i.message)
    return msgs
  }

  async getForwardMsg(data, message_id) {
    const msgs = (await data.bot.sendApi("get_forward_msg", {
      message_id,
    })).data?.messages

    for (const i of Array.isArray(msgs) ? msgs : [msgs])
      if (i?.message)
        i.message = this.parseMsg(i.message || i.content)
    return msgs
  }

  async makeForwardMsg(msg) {
    const msgs = []
    for (const i of msg) {
      const [content, forward] = await this.makeMsg(i.message)
      if (forward.length)
        msgs.push(...await this.makeForwardMsg(forward))
      if (content.length)
        msgs.push({ type: "node", data: {
          name: i.nickname || "匿名消息",
          uin: String(Number(i.user_id) || 80000000),
          content,
          time: i.time,
        }})
    }
    return msgs
  }

  async sendFriendForwardMsg(data, msg) {
    Bot.makeLog("info", `发送好友转发消息：${this.makeLog(msg)}`, `${data.self_id} => ${data.user_id}`, true)
    return data.bot.sendApi("send_private_forward_msg", {
      user_id: data.user_id,
      messages: await this.makeForwardMsg(msg),
    })
  }

  async sendGroupForwardMsg(data, msg) {
    Bot.makeLog("info", `发送群转发消息：${this.makeLog(msg)}`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("send_group_forward_msg", {
      group_id: data.group_id,
      messages: await this.makeForwardMsg(msg),
    })
  }

  async getFriendArray(data) {
    return (await data.bot.sendApi("get_friend_list")).data || []
  }

  async getFriendList(data) {
    const array = []
    for (const { user_id } of await this.getFriendArray(data))
      array.push(user_id)
    return array
  }

  async getFriendMap(data) {
    const map = new Map
    for (const i of await this.getFriendArray(data))
      map.set(i.user_id, i)
    data.bot.fl = map
    return map
  }

  getFriendInfo(data) {
    return data.bot.sendApi("get_stranger_info", {
      user_id: data.user_id,
    })
  }

  async getGroupArray(data) {
    const array = (await data.bot.sendApi("get_group_list")).data
    try { for (const guild of await this.getGuildArray(data))
      for (const channel of await this.getGuildChannelArray({
        ...data,
        guild_id: guild.guild_id,
      }))
        array.push({
          guild,
          channel,
          group_id: `${guild.guild_id}-${channel.channel_id}`,
          group_name: `${guild.guild_name}-${channel.channel_name}`,
        })
    } catch (err) {
      //Bot.makeLog("error", ["获取频道列表错误", err])
    }
    return array
  }

  async getGroupList(data) {
    const array = []
    for (const { group_id } of await this.getGroupArray(data))
      array.push(group_id)
    return array
  }

  async getGroupMap(data) {
    const map = new Map
    for (const i of await this.getGroupArray(data))
      map.set(i.group_id, i)
    data.bot.gl = map
    return map
  }

  getGroupInfo(data) {
    return data.bot.sendApi("get_group_info", {
      group_id: data.group_id,
    })
  }

  async getMemberArray(data) {
    return (await data.bot.sendApi("get_group_member_list", {
      group_id: data.group_id,
    })).data || []
  }

  async getMemberList(data) {
    const array = []
    for (const { user_id } of await this.getMemberArray(data))
      array.push(user_id)
    return array
  }

  async getMemberMap(data) {
    const map = new Map
    for (const i of await this.getMemberArray(data))
      map.set(i.user_id, i)
    data.bot.gml.set(data.group_id, map)
    return map
  }

  async getGroupMemberMap(data) {
    for (const [group_id, group] of await this.getGroupMap(data)) {
      if (group.guild) continue
      await this.getMemberMap({ ...data, group_id })
    }
  }

  getMemberInfo(data) {
    return data.bot.sendApi("get_group_member_info", {
      group_id: data.group_id,
      user_id: data.user_id,
    })
  }

  async getGuildArray(data) {
    return (await data.bot.sendApi("get_guild_list")).data || []
  }

  getGuildInfo(data) {
    return data.bot.sendApi("get_guild_meta_by_guest", {
      guild_id: data.guild_id,
    })
  }

  async getGuildChannelArray(data) {
    return (await data.bot.sendApi("get_guild_channel_list", {
      guild_id: data.guild_id,
    })).data || []
  }

  async getGuildChannelMap(data) {
    const map = new Map
    for (const i of await this.getGuildChannelArray(data))
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
      if (!list) break

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
    for (const { user_id } of await this.getGuildMemberArray(data))
      array.push(user_id)
    return array.push
  }

  async getGuildMemberMap(data) {
    const map = new Map
    for (const i of await this.getGuildMemberArray(data))
      map.set(i.user_id, i)
    data.bot.gml.set(data.group_id, map)
    return map
  }

  getGuildMemberInfo(data) {
    return data.bot.sendApi("get_guild_member_profile", {
      guild_id: data.guild_id,
      user_id: data.user_id,
    })
  }


  setProfile(data, profile) {
    Bot.makeLog("info", `设置资料：${Bot.String(profile)}`, data.self_id)
    return data.bot.sendApi("set_qq_profile", profile)
  }

  async setAvatar(data, file) {
    Bot.makeLog("info", `设置头像：${file}`, data.self_id)
    return data.bot.sendApi("set_qq_avatar", {
      file: await this.makeFile(file),
    })
  }

  sendLike(data, times) {
    Bot.makeLog("info", `点赞：${times}次`, `${data.self_id} => ${data.user_id}`, true)
    return data.bot.sendApi("send_like", {
      user_id: data.user_id,
      times,
    })
  }

  setGroupName(data, group_name) {
    Bot.makeLog("info", `设置群名：${group_name}`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("set_group_name", {
      group_id: data.group_id,
      group_name,
    })
  }

  async setGroupAvatar(data, file) {
    Bot.makeLog("info", `设置群头像：${file}`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("set_group_portrait", {
      group_id: data.group_id,
      file: await this.makeFile(file),
    })
  }

  setGroupAdmin(data, user_id, enable) {
    Bot.makeLog("info", `${enable ? "设置" : "取消"}群管理员：${user_id}`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("set_group_admin", {
      group_id: data.group_id,
      user_id,
      enable,
    })
  }

  setGroupCard(data, user_id, card) {
    Bot.makeLog("info", `设置群名片：${card}`, `${data.self_id} => ${data.group_id}, ${user_id}`, true)
    return data.bot.sendApi("set_group_card", {
      group_id: data.group_id,
      user_id,
      card,
    })
  }

  setGroupTitle(data, user_id, special_title, duration) {
    Bot.makeLog("info", `设置群头衔：${special_title} ${duration}`, `${data.self_id} => ${data.group_id}, ${user_id}`, true)
    return data.bot.sendApi("set_group_special_title", {
      group_id: data.group_id,
      user_id,
      special_title,
      duration,
    })
  }

  sendGroupSign(data) {
    Bot.makeLog("info", "群打卡", `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("send_group_sign", {
      group_id: data.group_id,
    })
  }

  setGroupBan(data, user_id, duration) {
    Bot.makeLog("info", `禁言群成员：${duration}秒`, `${data.self_id} => ${data.group_id}, ${user_id}`, true)
    return data.bot.sendApi("set_group_ban", {
      group_id: data.group_id,
      user_id,
      duration,
    })
  }

  setGroupWholeKick(data, enable) {
    Bot.makeLog("info", `${enable ? "开启" : "关闭"}全员禁言`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("set_group_whole_ban", {
      group_id: data.group_id,
      enable,
    })
  }

  setGroupKick(data, user_id, reject_add_request) {
    Bot.makeLog("info", `踢出群成员${reject_add_request ? "拒绝再次加群" : ""}`, `${data.self_id} => ${data.group_id}, ${user_id}`, true)
    return data.bot.sendApi("set_group_kick", {
      group_id: data.group_id,
      user_id,
      reject_add_request,
    })
  }

  setGroupLeave(data, is_dismiss) {
    Bot.makeLog("info", is_dismiss ? "解散" : "退群", `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("set_group_leave", {
      group_id: data.group_id,
      is_dismiss,
    })
  }

  downloadFile(data, url, thread_count, headers) {
    return data.bot.sendApi("download_file", {
      url,
      thread_count,
      headers,
    })
  }

  async sendFriendFile(data, file, name = path.basename(file)) {
    Bot.makeLog("info", `发送好友文件：${name}(${file})`, `${data.self_id} => ${data.user_id}`, true)
    return data.bot.sendApi("upload_private_file", {
      user_id: data.user_id,
      file: await this.makeFile(file, { file: true }),
      name,
    })
  }

  async sendGroupFile(data, file, folder, name = path.basename(file)) {
    Bot.makeLog("info", `发送群文件：${folder||""}/${name}(${file})`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("upload_group_file", {
      group_id: data.group_id,
      folder,
      file: await this.makeFile(file, { file: true }),
      name,
    })
  }

  deleteGroupFile(data, file_id, busid) {
    Bot.makeLog("info", `删除群文件：${file_id}(${busid})`, `${data.self_id} => ${data.group_id}`, true)
    return data.bot.sendApi("delete_group_file", {
      group_id: data.group_id,
      file_id,
      busid,
    })
  }

  createGroupFileFolder(data, name) {
    Bot.makeLog("info", `创建群文件夹：${name}`, `${data.self_id} => ${data.group_id}`, true)
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
      upload: this.sendGroupFile.bind(this, data),
      rm: this.deleteGroupFile.bind(this, data),
      mkdir: this.createGroupFileFolder.bind(this, data),
      df: this.getGroupFileSystemInfo.bind(this, data),
      ls: this.getGroupFiles.bind(this, data),
      download: this.getGroupFileUrl.bind(this, data),
    }
  }

  deleteFriend(data) {
    Bot.makeLog("info", "删除好友", `${data.self_id} => ${data.user_id}`, true)
    return data.bot.sendApi("delete_friend", { user_id: data.user_id })
      .finally(this.getFriendMap.bind(this, data))
  }

  setFriendAddRequest(data, flag, approve, remark) {
    return data.bot.sendApi("set_friend_add_request", {
      flag,
      approve,
      remark,
    })
  }

  setGroupAddRequest(data, flag, approve, reason, sub_type = "add") {
    return data.bot.sendApi("set_group_add_request", {
      flag,
      sub_type,
      approve,
      reason,
    })
  }

  getGroupHonorInfo(data) {
    return data.bot.sendApi("get_group_honor_info", { group_id: data.group_id })
  }

  getEssenceMsg(data) {
    return data.bot.sendApi("get_essence_msg_list", { group_id: data.group_id })
  }

  setEssenceMsg(data, message_id) {
    return data.bot.sendApi("set_essence_msg", { message_id })
  }

  deleteEssenceMsg(data, message_id) {
    return data.bot.sendApi("delete_essence_msg", { message_id })
  }

  pickFriend(data, user_id) {
    const i = {
      ...data.bot.fl.get(user_id),
      ...data,
      user_id,
    }
    return {
      ...i,
      sendMsg: this.sendFriendMsg.bind(this, i),
      getMsg: this.getMsg.bind(this, i),
      recallMsg: this.recallMsg.bind(this, i),
      getForwardMsg: this.getForwardMsg.bind(this, i),
      sendForwardMsg: this.sendFriendForwardMsg.bind(this, i),
      sendFile: this.sendFriendFile.bind(this, i),
      getInfo: this.getFriendInfo.bind(this, i),
      getAvatarUrl() { return this.avatar || `https://q.qlogo.cn/g?b=qq&s=0&nk=${user_id}` },
      getChatHistory: this.getFriendMsgHistory.bind(this, i),
      thumbUp: this.sendLike.bind(this, i),
      delete: this.deleteFriend.bind(this, i),
    }
  }

  pickMember(data, group_id, user_id) {
    if (typeof group_id === "string" && group_id.match("-")) {
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
        getInfo: this.getGuildMemberInfo.bind(this, i),
        getAvatarUrl: async () => (await this.getGuildMemberInfo(i)).avatar_url,
      }
    }

    const i = {
      ...data.bot.gml.get(group_id)?.get(user_id),
      ...data,
      group_id,
      user_id,
    }
    return {
      ...this.pickFriend(i, user_id),
      ...i,
      getInfo: this.getMemberInfo.bind(this, i),
      getAvatarUrl() { return this.avatar || `https://q.qlogo.cn/g?b=qq&s=0&nk=${user_id}` },
      poke: this.sendGroupMsg.bind(this, i, { type: "poke", qq: user_id }),
      mute: this.setGroupBan.bind(this, i, user_id),
      kick: this.setGroupKick.bind(i, user_id),
      get is_friend() { return data.bot.fl.has(user_id) },
      get is_owner() { return this.role === "owner" },
      get is_admin() { return this.role === "admin" || this.is_owner },
    }
  }

  pickGroup(data, group_id) {
    if (typeof group_id === "string" && group_id.match("-")) {
      const guild_id = group_id.split("-")
      const i = {
        ...data.bot.gl.get(group_id),
        ...data,
        guild_id: guild_id[0],
        channel_id: guild_id[1],
      }
      return {
        ...i,
        sendMsg: this.sendGuildMsg.bind(this, i),
        getMsg: this.getMsg.bind(this, i),
        recallMsg: this.recallMsg.bind(this, i),
        getForwardMsg: this.getForwardMsg.bind(this, i),
        getInfo: this.getGuildInfo.bind(this, i),
        getChannelArray: this.getGuildChannelArray.bind(this, i),
        getChannelList: this.getGuildChannelList.bind(this, i),
        getChannelMap: this.getGuildChannelMap.bind(this, i),
        getMemberArray: this.getGuildMemberArray.bind(this, i),
        getMemberList: this.getGuildMemberList.bind(this, i),
        getMemberMap: this.getGuildMemberMap.bind(this, i),
        pickMember: this.pickMember.bind(this, i),
      }
    }

    const i = {
      ...data.bot.gl.get(group_id),
      ...data,
      group_id,
    }
    return {
      ...i,
      sendMsg: this.sendGroupMsg.bind(this, i),
      getMsg: this.getMsg.bind(this, i),
      recallMsg: this.recallMsg.bind(this, i),
      getForwardMsg: this.getForwardMsg.bind(this, i),
      sendForwardMsg: this.sendGroupForwardMsg.bind(this, i),
      sendFile: (file, name) => this.sendGroupFile(i, file, undefined, name),
      getInfo: this.getGroupInfo.bind(this, i),
      getAvatarUrl() { return this.avatar || `https://p.qlogo.cn/gh/${group_id}/${group_id}/0` },
      getChatHistory: this.getGroupMsgHistory.bind(this, i),
      getHonorInfo: this.getGroupHonorInfo.bind(this, i),
      getEssence: this.getEssenceMsg.bind(this, i),
      getMemberArray: this.getMemberArray.bind(this, i),
      getMemberList: this.getMemberList.bind(this, i),
      getMemberMap: this.getMemberMap.bind(this, i),
      pickMember: this.pickMember.bind(this, i, group_id),
      pokeMember: qq => this.sendGroupMsg(i, { type: "poke", qq }),
      setName: this.setGroupName.bind(this, i),
      setAvatar: this.setGroupAvatar.bind(this, i),
      setAdmin: this.setGroupAdmin.bind(this, i),
      setCard: this.setGroupCard.bind(this, i),
      setTitle: this.setGroupTitle.bind(this, i),
      sign: this.sendGroupSign.bind(this, i),
      muteMember: this.setGroupBan.bind(this, i),
      muteAll: this.setGroupWholeKick.bind(this, i),
      kickMember: this.setGroupKick.bind(this, i),
      quit: this.setGroupLeave.bind(this, i),
      fs: this.getGroupFs(i),
      get is_owner() { return data.bot.gml.get(group_id)?.get(data.self_id)?.role === "owner" },
      get is_admin() { return data.bot.gml.get(group_id)?.get(data.self_id)?.role === "admin" || this.is_owner },
    }
  }

  async connect(data, ws) {
    Bot[data.self_id] = {
      adapter: this,
      ws: ws,
      sendApi: this.sendApi.bind(this, data, ws),
      stat: {
        start_time: data.time,
        stat: {},
        get lost_pkt_cnt() { return this.stat.packet_lost },
        get lost_times() { return this.stat.lost_times },
        get recv_msg_cnt() { return this.stat.message_received },
        get recv_pkt_cnt() { return this.stat.packet_received },
        get sent_msg_cnt() { return this.stat.message_sent },
        get sent_pkt_cnt() { return this.stat.packet_sent },
      },
      model: "TRSS Yunzai ",

      info: {},
      get uin() { return this.info.user_id },
      get nickname() { return this.info.nickname },
      get avatar() { return `https://q.qlogo.cn/g?b=qq&s=0&nk=${this.uin}` },

      setProfile: this.setProfile.bind(this, data),
      setNickname: nickname => this.setProfile(data, { nickname }),
      setAvatar: this.setAvatar.bind(this, data),

      pickFriend: this.pickFriend.bind(this, data),
      get pickUser() { return this.pickFriend },
      getFriendArray: this.getFriendArray.bind(this, data),
      getFriendList: this.getFriendList.bind(this, data),
      getFriendMap: this.getFriendMap.bind(this, data),
      fl: new Map,

      pickMember: this.pickMember.bind(this, data),
      pickGroup: this.pickGroup.bind(this, data),
      getGroupArray: this.getGroupArray.bind(this, data),
      getGroupList: this.getGroupList.bind(this, data),
      getGroupMap: this.getGroupMap.bind(this, data),
      getGroupMemberMap: this.getGroupMemberMap.bind(this, data),
      gl: new Map,
      gml: new Map,

      request_list: [],
      getSystemMsg() { return this.request_list },
      setFriendAddRequest: this.setFriendAddRequest.bind(this, data),
      setGroupAddRequest: this.setGroupAddRequest.bind(this, data),

      setEssenceMessage: this.setEssenceMsg.bind(this, data),
      removeEssenceMessage: this.deleteEssenceMsg.bind(this, data),

      cookies: {},
      getCookies(domain) { return this.cookies[domain] },
      getCsrfToken() { return this.bkn },
    }
    data.bot = Bot[data.self_id]

    if (!Bot.uin.includes(data.self_id))
      Bot.uin.push(data.self_id)

    data.bot.sendApi("_set_model_show", {
      model: data.bot.model,
      model_show: data.bot.model,
    }).catch(() => {})

    data.bot.info = (await data.bot.sendApi("get_login_info").catch(i => i.error)).data
    data.bot.guild_info = (await data.bot.sendApi("get_guild_service_profile").catch(i => i.error)).data
    data.bot.clients = (await data.bot.sendApi("get_online_clients").catch(i => i.error)).clients
    data.bot.version = {
      ...(await data.bot.sendApi("get_version_info").catch(i => i.error)).data,
      id: this.id,
      name: this.name,
      get version() {
        return this.app_full_name || `${this.app_name} v${this.app_version}`
      },
    }

    if (data.bot.cookies["qun.qq.com"] = (
      await data.bot.sendApi("get_cookies", { domain: "qun.qq.com" }).catch(i => i.error)
    ).cookies) for (const i of ["aq", "connect", "docs", "game", "gamecenter", "haoma", "id", "kg", "mail", "mma", "office", "openmobile", "qqweb", "qzone", "ti", "v", "vip", "y"]) {
      const domain = `${i}.qq.com`
      data.bot.cookies[domain] = await data.bot.sendApi("get_cookies", { domain })
        .then(i => i.cookies).catch(i => i.error)
    }
    data.bot.bkn = (await data.bot.sendApi("get_csrf_token").catch(i => i.error)).token

    data.bot.getFriendMap()
    data.bot.getGroupMemberMap()

    Bot.makeLog("mark", `${this.name}(${this.id}) ${data.bot.version.version} 已连接`, data.self_id)
    Bot.em(`connect.${data.self_id}`, data)
  }

  makeMessage(data) {
    data.message = this.parseMsg(data.message)
    switch (data.message_type) {
      case "private": {
        const name = data.sender.card || data.sender.nickname || data.bot.fl.get(data.user_id)?.nickname
        Bot.makeLog("info", `好友消息：${name ? `[${name}] ` : ""}${data.raw_message}`, `${data.self_id} <= ${data.user_id}`, true)
        break
      } case "group": {
        const group_name = data.group_name || data.bot.gl.get(data.group_id)?.group_name
        let user_name = data.sender.card || data.sender.nickname
        if (!user_name) {
          const user = data.bot.gml.get(data.group_id)?.get(data.user_id) || data.bot.fl.get(data.user_id)
          if (user) user_name = user?.card || user?.nickname
        }
        Bot.makeLog("info", `群消息：${user_name ? `[${group_name ? `${group_name}, ` : ""}${user_name}] ` : ""}${data.raw_message}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        break
      } case "guild":
        data.message_type = "group"
        data.group_id = `${data.guild_id}-${data.channel_id}`
        Bot.makeLog("info", `频道消息：[${data.sender.nickname}] ${Bot.String(data.message)}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        Object.defineProperty(data, "friend", { get() { return this.member || {}}})
        break
      default:
        Bot.makeLog("warn", `未知消息：${logger.magenta(data.raw)}`, data.self_id)
    }

    Bot.em(`${data.post_type}.${data.message_type}.${data.sub_type}`, data)
  }

  async makeNotice(data) {
    switch (data.notice_type) {
      case "friend_recall":
        Bot.makeLog("info", `好友消息撤回：${data.message_id}`, `${data.self_id} <= ${data.user_id}`, true)
        break
      case "group_recall":
        Bot.makeLog("info", `群消息撤回：${data.operator_id} => ${data.user_id} ${data.message_id}`, `${data.self_id} <= ${data.group_id}`, true)
        break
      case "group_increase":
        Bot.makeLog("info", `群成员增加：${data.operator_id} => ${data.user_id} ${data.sub_type}`, `${data.self_id} <= ${data.group_id}`, true)
        if (data.user_id === data.self_id)
          data.bot.getGroupMemberMap()
        else
          data.bot.pickGroup(data.group_id).getMemberMap()
        break
      case "group_decrease":
        Bot.makeLog("info", `群成员减少：${data.operator_id} => ${data.user_id} ${data.sub_type}`, `${data.self_id} <= ${data.group_id}`, true)
        if (data.user_id === data.self_id)
          data.bot.getGroupMemberMap()
        else
          data.bot.pickGroup(data.group_id).getMemberMap()
        break
      case "group_admin":
        Bot.makeLog("info", `群管理员变动：${data.sub_type}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        data.set = data.sub_type === "set"
        break
      case "group_upload":
        Bot.makeLog("info", `群文件上传：${Bot.String(data.file)}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        Bot.em("message.group.normal", {
          ...data,
          post_type: "message",
          message_type: "group",
          sub_type: "normal",
          message: [{ ...data.file, type: "file" }],
          raw_message: `[文件：${data.file.name}]`,
        })
        break
      case "group_ban":
        Bot.makeLog("info", `群禁言：${data.operator_id} => ${data.user_id} ${data.sub_type} ${data.duration}秒`, `${data.self_id} <= ${data.group_id}`, true)
        break
      case "friend_add":
        Bot.makeLog("info", "好友添加", `${data.self_id} <= ${data.user_id}`, true)
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
              Bot.makeLog("info", `群戳一戳：${data.operator_id} => ${data.target_id}`, `${data.self_id} <= ${data.group_id}`, true)
            else
              Bot.makeLog("info", `好友戳一戳：${data.operator_id} => ${data.target_id}`, data.self_id)
            break
          case "honor":
            Bot.makeLog("info", `群荣誉：${data.honor_type}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
            break
          case "title":
            Bot.makeLog("info", `群头衔：${data.title}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
            break
          default:
            Bot.makeLog("warn", `未知通知：${logger.magenta(data.raw)}`, data.self_id)
        }
        break
      case "group_card":
        Bot.makeLog("info", `群名片更新：${data.card_old} => ${data.card_new}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        break
      case "offline_file":
        Bot.makeLog("info", `离线文件：${Bot.String(data.file)}`, `${data.self_id} <= ${data.user_id}`, true)
        Bot.em("message.private.friend", {
          ...data,
          post_type: "message",
          message_type: "private",
          sub_type: "friend",
          message: [{ ...data.file, type: "file" }],
          raw_message: `[文件：${data.file.name}]`,
        })
        break
      case "client_status":
        Bot.makeLog("info", `客户端${data.online ? "上线" : "下线"}：${Bot.String(data.client)}`, data.self_id)
        data.clients = (await data.bot.sendApi("get_online_clients")).clients
        data.bot.clients = data.clients
        break
      case "essence":
        data.notice_type = "group_essence"
        Bot.makeLog("info", `群精华消息：${data.operator_id} => ${data.sender_id} ${data.sub_type} ${data.message_id}`, `${data.self_id} <= ${data.group_id}`, true)
        break
      case "guild_channel_recall":
        Bot.makeLog("info", `频道消息撤回：${data.operator_id} => ${data.user_id} ${data.message_id}`, `${data.self_id} <= ${data.guild_id}-${data.channel_id}`, true)
        break
      case "message_reactions_updated":
        data.notice_type = "guild_message_reactions_updated"
        Bot.makeLog("info", `频道消息表情贴：${data.message_id} ${Bot.String(data.current_reactions)}`, `${data.self_id} <= ${data.guild_id}-${data.channel_id}, ${data.user_id}`, true)
        break
      case "channel_updated":
        data.notice_type = "guild_channel_updated"
        Bot.makeLog("info", `子频道更新：${Bot.String(data.old_info)} => ${Bot.String(data.new_info)}`, `${data.self_id} <= ${data.guild_id}-${data.channel_id}, ${data.user_id}`, true)
        break
      case "channel_created":
        data.notice_type = "guild_channel_created"
        Bot.makeLog("info", `子频道创建：${Bot.String(data.channel_info)}`, `${data.self_id} <= ${data.guild_id}-${data.channel_id}, ${data.user_id}`, true)
        data.bot.getGroupMap()
        break
      case "channel_destroyed":
        data.notice_type = "guild_channel_destroyed"
        Bot.makeLog("info", `子频道删除：${Bot.String(data.channel_info)}`, `${data.self_id} <= ${data.guild_id}-${data.channel_id}, ${data.user_id}`, true)
        data.bot.getGroupMap()
        break
      default:
        Bot.makeLog("warn", `未知通知：${logger.magenta(data.raw)}`, data.self_id)
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
        Bot.makeLog("info", `加好友请求：${data.comment}(${data.flag})`, `${data.self_id} <= ${data.user_id}`, true)
        data.sub_type = "add"
        data.approve = function (approve, remark) { return this.bot.setFriendAddRequest(this.flag, approve, remark) }
        break
      case "group":
        Bot.makeLog("info", `加群请求：${data.sub_type} ${data.comment}(${data.flag})`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`, true)
        data.approve = function (approve, reason) { return this.bot.setGroupAddRequest(this.flag, approve, reason, this.sub_type) }
        break
      default:
        Bot.makeLog("warn", `未知请求：${logger.magenta(data.raw)}`, data.self_id)
    }

    data.bot.request_list.push(data)
    Bot.em(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
  }

  heartbeat(data) {
    if (data.status)
      Object.assign(data.bot.stat, data.status)
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
        Bot.makeLog("warn", `未知消息：${logger.magenta(data.raw)}`, data.self_id)
    }
  }

  message(data, ws) {
    try {
      data = {
        ...JSON.parse(data),
        raw: Bot.String(data),
      }
    } catch (err) {
      return Bot.makeLog("error", ["解码数据失败", data, err])
    }

    if (data.post_type) {
      if (data.meta_event_type !== "lifecycle" && !Bot.uin.includes(data.self_id)) {
        Bot.makeLog("warn", `找不到对应Bot，忽略消息：${logger.magenta(data.raw)}`, data.self_id)
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
          Bot.makeLog("warn", `未知消息：${logger.magenta(data.raw)}`, data.self_id)
      }
    } else if (data.echo && this.echo[data.echo]) {
      if (![0, 1].includes(data.retcode))
        this.echo[data.echo].reject(Object.assign(
          this.echo[data.echo].error,
          this.echo[data.echo].request,
          { error: data },
        ))
      else
        this.echo[data.echo].resolve(data.data ? new Proxy(data, {
          get: (target, prop) => target.data[prop] ?? target[prop],
        }) : data)
      clearTimeout(this.echo[data.echo].timeout)
      delete this.echo[data.echo]
    } else {
      Bot.makeLog("warn", `未知消息：${logger.magenta(data.raw)}`, data.self_id)
    }
  }

  load() {
    for (const i of [this.path, "go-cqhttp"]) {
      if (!Array.isArray(Bot.wsf[i]))
        Bot.wsf[i] = []
      Bot.wsf[i].push((ws, ...args) =>
        ws.on("message", data => this.message(data, ws, ...args))
      )
    }
  }
})