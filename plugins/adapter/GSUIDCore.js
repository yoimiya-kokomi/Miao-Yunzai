Bot.adapter.push(new class GSUIDCoreAdapter {
  constructor() {
    this.id = "GSUIDCore"
    this.name = "早柚核心"
    this.path = this.id
  }

  makeLog(msg) {
    return Bot.String(msg).replace(/base64:\/\/.*?"/g, "base64://...\"")
  }

  makeButton(data, button) {
    const msg = {
      text: button.text,
      pressed_text: button.clicked_text,
      ...button.GSUIDCore,
    }

    if (button.input) {
      msg.data = button.input
      msg.action = 2
    } else if (button.callback) {
      msg.data = button.callback
      msg.action = 1
    } else if (button.link) {
      msg.data = button.link
      msg.action = 0
    } else return false

    if (button.permission) {
      if (button.permission == "admin") {
        msg.permission = 1
      } else {
        msg.permission = 0
        if (!Array.isArray(button.permission))
          button.permission = [button.permission]
        msg.specify_user_ids = button.permission
      }
    }
    return msg
  }

  makeButtons(button_square) {
    const msgs = []
    for (const button_row of button_square) {
      const buttons = []
      for (let button of button_row) {
        button = this.makeButton(button)
        if (button) buttons.push(button)
      }
      msgs.push(buttons)
    }
    return msgs
  }

  async makeMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    const msgs = []
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", text: i }

      if (i.file) {
        i.file = await Bot.Buffer(i.file, { http: true })
        if (Buffer.isBuffer(i.file))
          i.file = `base64://${i.file.toString("base64")}`
      }

      switch (i.type) {
        case "text":
          i = { type: "text", data: i.text }
          break
        case "image":
          i = { type: "image", data: i.file }
          break
        case "record":
          i = { type: "record", data: i.file }
          break
        case "video":
          i = { type: "file", data: i.file }
          break
        case "file":
          i = { type: "file", data: i.file }
          break
        case "at":
          i = { type: "at", data: i.qq }
          break
        case "reply":
          i = { type: "reply", data: i.id }
          break
        case "button":
          i = { type: "buttons", data: this.makeButtons(i.data) }
          break
        case "markdown":
          break
        case "node": {
          const array = []
          for (const { message } of i.data)
            array.push(...await this.makeMsg(message))
          i.data = array
          break
        } default:
          i = { type: "text", data: JSON.stringify(i) }
      }
      msgs.push(i)
    }
    return msgs
  }

  async sendFriendMsg(data, msg) {
    const content = await this.makeMsg(msg)
    Bot.makeLog("info", `发送好友消息：${this.makeLog(content)}`, `${data.self_id} => ${data.user_id}`)
    data.bot.sendApi({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: "direct",
      target_id: data.user_id,
      content,
    })
    return { message_id: Date.now() }
  }

  async sendGroupMsg(data, msg) {
    const target = data.group_id.split("-")
    const content = await this.makeMsg(msg)
    Bot.makeLog("info", `发送群消息：${this.makeLog(content)}`, `${data.self_id} => ${data.group_id}`)
    data.bot.sendApi({
      bot_id: data.bot.bot_id,
      bot_self_id: data.bot.bot_self_id,
      target_type: target[0],
      target_id: target[1],
      content,
    })
    return { message_id: Date.now() }
  }

  pickFriend(id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      self_id: id,
      bot: Bot[id],
      user_id: user_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendFriendMsg(i, msg),
    }
  }

  pickMember(id, group_id, user_id) {
    const i = {
      ...Bot[id].fl.get(user_id),
      ...Bot[id].gml.get(group_id)?.get(user_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id,
      user_id: user_id,
    }
    return {
      ...this.pickFriend(id, user_id),
      ...i,
    }
  }

  pickGroup(id, group_id) {
    const i = {
      ...Bot[id].gl.get(group_id),
      self_id: id,
      bot: Bot[id],
      group_id: group_id,
    }
    return {
      ...i,
      sendMsg: msg => this.sendGroupMsg(i, msg),
      pickMember: user_id => this.pickMember(id, group_id, user_id),
    }
  }

  makeBot(data, ws) {
    Bot[data.self_id] = {
      adapter: this,
      ws: ws,
      get sendApi() { return this.ws.sendMsg },
      uin: data.self_id,
      bot_id: data.raw.bot_id,
      bot_self_id: data.raw.bot_self_id,
      stat: { start_time: Date.now()/1000 },
      version: {
        id: this.id,
        name: this.name,
      },
      pickFriend: user_id => this.pickFriend(data.self_id, user_id),
      get pickUser() { return this.pickFriend },
      pickMember: (group_id, user_id) => this.pickMember(data.self_id, group_id, user_id),
      pickGroup: group_id => this.pickGroup(data.self_id, group_id),
      fl: new Map,
      gl: new Map,
      gml: new Map,
    }
    data.bot = Bot[data.self_id]

    Bot.makeLog("mark", `${this.name}(${this.id}) 已连接`, data.self_id)
    Bot.em(`connect.${data.self_id}`, data)
  }

  message(raw, ws) {
    try {
      raw = JSON.parse(Bot.String(raw))
    } catch (err) {
      return Bot.makeLog("error", ["解码数据失败", raw, err])
    }

    const data = {
      raw,
      self_id: raw.bot_self_id,
      post_type: "message",
      message_id: raw.msg_id,
      get user_id() { return this.sender.user_id },
      sender: {
        user_id: raw.user_id,
        user_pm: raw.user_pm,
      },
      message: [],
      raw_message: "",
    }

    if (Bot[data.self_id]) {
      data.bot = Bot[data.self_id]
      data.bot.ws = ws
    } else {
      this.makeBot(data, ws)
    }

    if (!data.bot.fl.has(data.user_id))
      data.bot.fl.set(data.user_id, data.sender)

    for (const i of data.content) {
      switch (i.type) {
        case "text":
          data.message.push({ type: "text", text: i.data })
          data.raw_message += i.data
          break
        case "image":
          data.message.push({ type: "image", url: i.data })
          data.raw_message += `[图片：${i.data}]`
          break
        case "file":
          data.message.push({ type: "file", url: i.data })
          data.raw_message += `[文件：${i.data}]`
          break
        case "at":
          data.message.push({ type: "at", qq: i.data })
          data.raw_message += `[提及：${i.data}]`
          break
        case "reply":
          data.message.push({ type: "reply", id: i.data })
          data.raw_message += `[回复：${i.data}]`
          break
        case "node":
          data.message.push({ type: "node", data: i.data })
          data.raw_message += `[合并转发：${JSON.stringify(i.data)}]`
          break
        default:
          data.message.push(i)
          data.raw_message += JSON.stringify(i)
      }
    }

    if (data.user_type == "direct") {
      data.message_type = "private"
      Bot.makeLog("info", `好友消息：${data.raw_message}`, `${data.self_id} <= ${data.user_id}`)
    } else {
      data.message_type = "group"
      data.group_id = `${data.user_type}-${data.group_id}`

      if (!data.bot.gl.has(data.group_id))
        data.bot.gl.set(data.group_id, { group_id: data.group_id })
      let gml = data.bot.gml.get(data.group_id)
      if (!gml) {
        gml = new Map
        data.bot.gml.set(data.group_id, gml)
      }
      if (!gml.has(data.user_id))
        gml.set(data.user_id, data.sender)

      Bot.makeLog("info", `群消息：${data.raw_message}`, `${data.self_id} <= ${data.group_id}, ${data.user_id}`)
    }

    Bot.em(`${data.post_type}.${data.message_type}`, data)
  }

  load() {
    if (!Array.isArray(Bot.wsf[this.path]))
      Bot.wsf[this.path] = []
    Bot.wsf[this.path].push((ws, ...args) =>
      ws.on("message", data => this.message(data, ws, ...args))
    )
  }
})