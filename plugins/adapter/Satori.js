import cfg from "../../lib/config/config.js"
import fetch from "node-fetch"
import { WebSocket } from "ws"
import { fileTypeFromBuffer } from "file-type"

Bot.adapter.push(
  new (class SatoriAdapter {
    id = "Satori"
    name = "Satori"
    path = this.name
    timeout = 60000
    sessionSn = 0
    ws = null
    heartbeatTimer = null

    load() {
      if (!cfg.satori?.enable) return

      this.httpEndpoint = cfg.satori.http_endpoint || "http://127.0.0.1:5140/satori/v1"
      this.wsEndpoint = cfg.satori.ws_endpoint || "ws://127.0.0.1:5140/satori/v1/events"
      this.token = cfg.satori.token && cfg.satori.token.trim() !== "" ? cfg.satori.token : null
      this.platform = cfg.satori.platform || "satori"
      this.timeout = cfg.satori.timeout || 60000
      this.heartbeatInterval = cfg.satori.heartbeat_interval || 10000

      this.connectWebSocket()
    }

    makeLog(msg) {
      return Bot.String(msg).replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
    }

    async sendApi(method, params = {}, selfId) {
      const url = `${this.httpEndpoint}/${method}`
      const headers = {
        "Content-Type": "application/json",
      }

      let bot = Bot.bots[selfId]
      // 如果指定的bot不存在，尝试查找一个可用的bot
      if (!bot || bot.adapter !== this) {
        const availableBots = Object.values(Bot.bots).filter(b => b.adapter === this)
        if (availableBots.length > 0) {
          bot = availableBots[0]
          Bot.makeLog(
            "warn",
            `使用替代bot ${bot.self_id} 发送API请求，原bot ${selfId} 不存在`,
            "Satori",
          )
        }
      }

      if (bot && bot.adapter === this) {
        headers["Satori-Platform"] = bot.platform
        headers["Satori-User-ID"] = bot.self_id
      } else {
        headers["Satori-Platform"] = this.platform
        if (selfId) {
          headers["Satori-User-ID"] = selfId
        } else {
          Bot.makeLog("error", "缺少 self_id，无法调用 API: " + method, "Satori")
          throw new Error("缺少 self_id，无法调用 API")
        }
      }

      // token 是可选的
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
          timeout: this.timeout,
        })

        if (!response.ok) {
          const errorText = await response.text()
          Bot.makeLog(
            "error",
            [`HTTP ${response.status}: ${response.statusText}`, errorText],
            "Satori",
          )

          if (response.status === 403) {
            if (errorText.includes("login not found")) {
              Bot.makeLog(
                "error",
                [
                  "找不到登录会话：",
                  `self_id (${selfId}) `,
                  `当前可用的登录: ${Object.keys(Bot.bots)
                    .filter(id => Bot.bots[id].adapter === this)
                    .join(", ")}`,
                  `使用的平台: ${headers["Satori-Platform"]}`,
                ],
                "Satori",
              )
            }
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        return result
      } catch (err) {
        Bot.makeLog("error", ["Satori HTTP API 请求失败", method, params, err], selfId || "Unknown")
        throw err
      }
    }

    async makeFile(file, opts) {
      file = await Bot.Buffer(file, {
        http: true,
        size: 10485760,
        ...opts,
      })
      if (Buffer.isBuffer(file)) {
        let mimeType = "image/jpeg"
        try {
          const type = await fileTypeFromBuffer(file)
          if (type?.mime) mimeType = type.mime
        } catch (err) {
          Bot.makeLog("error", ["文件类型检测错误", file, err])
        }
        return `data:${mimeType};base64,${file.toString("base64")}`
      }
      return file
    }

    async makeSatoriElements(msg) {
      if (!Array.isArray(msg)) msg = [msg]
      const elements = []

      for (let item of msg) {
        if (typeof item !== "object") {
          elements.push(item.toString())
          continue
        }

        if (!item.data) item = { type: item.type, data: { ...item, type: undefined } }

        switch (item.type) {
          case "text":
            elements.push(item.data.text || item.data.content || "")
            break
          case "at":
            if (item.data.qq === "all") {
              elements.push(`<at type="all"/>`)
            } else {
              elements.push(`<at id="${item.data.qq}"/>`)
            }
            break
          case "image":
          case "img":
            const imgSrc = await this.makeFile(item.data.file || item.data.url)
            elements.push(`<img src="${imgSrc}"/>`)
            break
          case "audio":
          case "record":
            const audioSrc = await this.makeFile(item.data.file || item.data.url)
            elements.push(`<audio src="${audioSrc}"/>`)
            break
          case "video":
            const videoSrc = await this.makeFile(item.data.file || item.data.url)
            elements.push(`<video src="${videoSrc}"/>`)
            break
          case "file":
            const fileSrc = await this.makeFile(item.data.file || item.data.url)
            elements.push(`<file src="${fileSrc}" title="${item.data.name || ""}"/>`)
            break
          case "reply":
            elements.push(`<quote id="${item.data.id}"/>`)
            break
          case "button":
            if (Array.isArray(item.data)) {
              // 处理按钮数组格式
              for (const row of item.data) {
                for (const btn of row) {
                  const btnText = btn.text || ""
                  const btnInput = btn.input || ""
                  elements.push(`<button id="${btnInput}">${btnText}</button>`)
                }
              }
            } else {
              const btnText = item.data.text || ""
              const btnId = item.data.id || item.data.input || ""
              elements.push(`<button id="${btnId}">${btnText}</button>`)
            }
            break
          case "node":
            const nodeElements = await this.makeSatoriElements(item.data)
            elements.push(`<message forward>${nodeElements.join("")}</message>`)
            break
          case "raw":
            elements.push(item.data)
            break
          default:
            if (item.data?.text) {
              elements.push(item.data.text)
            } else {
              elements.push(Bot.String(item))
            }
        }
      }

      return elements.join("")
    }

    async sendMsg(msg, channelId, selfId) {
      const content = await this.makeSatoriElements(msg)
      if (!content.trim()) return

      return await this.sendApi(
        "message.create",
        {
          channel_id: channelId,
          content,
        },
        selfId,
      )
    }

    async sendFriendMsg(data, msg) {
      Bot.makeLog(
        "info",
        `发送私聊消息：${this.makeLog(msg)}`,
        `${data.self_id} => ${data.user_id}`,
        true,
      )

      let channelId = data.channel_id

      if (!channelId || channelId === data.user_id) {
        try {
          const channel = await this.sendApi(
            "user.channel.create",
            {
              user_id: data.user_id,
            },
            data.self_id,
          )
          channelId = channel.id
        } catch (err) {
          Bot.makeLog(
            "error",
            ["创建私聊频道失败，使用 user_id 作为 channel_id", err],
            data.self_id,
          )
          channelId = data.user_id
        }
      }

      return this.sendMsg(msg, channelId, data.self_id)
    }

    sendGroupMsg(data, msg) {
      Bot.makeLog(
        "info",
        `发送群消息：${this.makeLog(msg)}`,
        `${data.self_id} => ${data.group_id}`,
        true,
      )
      return this.sendMsg(msg, data.channel_id || data.group_id, data.self_id)
    }

    sendGuildMsg(data, msg) {
      Bot.makeLog(
        "info",
        `发送频道消息：${this.makeLog(msg)}`,
        `${data.self_id} => ${data.guild_id}-${data.channel_id}`,
        true,
      )
      return this.sendMsg(msg, data.channel_id, data.self_id)
    }

    async recallMsg(data, message_id) {
      Bot.makeLog("info", `撤回消息：${message_id}`, data.self_id)
      if (!Array.isArray(message_id)) message_id = [message_id]
      const msgs = []
      for (const id of message_id) {
        try {
          await this.sendApi(
            "message.delete",
            {
              channel_id: data.channel_id,
              message_id: id,
            },
            data.self_id,
          )
          msgs.push({ success: true, message_id: id })
        } catch (err) {
          msgs.push({ success: false, message_id: id, error: err })
        }
      }
      return msgs
    }

    parseElements(content) {
      const result = []
      if (!content) return result

      const elementRegex = /<(\w+)([^>]*)(?:\/>|>(.*?)<\/\1>)/g
      let lastIndex = 0
      let match

      while ((match = elementRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          const text = content.slice(lastIndex, match.index)
          if (text.trim()) {
            result.push({ type: "text", text })
          }
        }

        const [, tagName, attributes, innerContent] = match
        const attrs = {}

        const attrRegex = /(\w+)="([^"]*)"/g
        let attrMatch
        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2]
        }

        switch (tagName) {
          case "at":
            if (attrs.type === "all") {
              result.push({ type: "at", qq: "all" })
            } else if (attrs.id) {
              result.push({ type: "at", qq: attrs.id })
            }
            break
          case "img":
            result.push({ type: "image", url: attrs.src, file: attrs.src })
            break
          case "audio":
            result.push({ type: "record", url: attrs.src, file: attrs.src })
            break
          case "video":
            result.push({ type: "video", url: attrs.src, file: attrs.src })
            break
          case "file":
            result.push({ type: "file", url: attrs.src, file: attrs.src, name: attrs.title })
            break
          case "quote":
            result.push({ type: "reply", id: attrs.id })
            break
          case "button":
            result.push({ type: "button", id: attrs.id, text: innerContent || "" })
            break
          default:
            if (innerContent) {
              result.push({ type: "text", text: innerContent })
            }
        }

        lastIndex = elementRegex.lastIndex
      }

      if (lastIndex < content.length) {
        const text = content.slice(lastIndex)
        if (text.trim()) {
          result.push({ type: "text", text })
        }
      }

      return result
    }

    makeMsg(event) {
      const msg = {
        post_type: "message",
        message_type: event.channel?.type === 1 ? "private" : "group",
        sub_type: "normal",
        message_id: event.message?.id,
        user_id: event.user?.id,
        time: Math.floor((event.timestamp || Date.now()) / 1000),
        self_id: event.login?.user?.id,
        raw_message: event.message?.content || "",
        font: 0,
        sender: {
          user_id: event.user?.id,
          nickname: event.user?.name || event.user?.nick,
          card: event.member?.nick || "",
          role: event.member?.roles?.[0]?.name || "member",
        },
      }

      if (event.channel?.type === 1) {
        msg.detail_type = "private"
        msg.channel_id = event.channel.id
      } else {
        msg.detail_type = "group"
        msg.group_id = event.guild?.id || event.channel?.id
        msg.group_name = event.guild?.name || event.channel?.name
        msg.channel_id = event.channel?.id
      }

      if (event.guild && event.channel) {
        msg.guild_id = event.guild.id
        msg.channel_id = event.channel.id
        msg.channel_name = event.channel.name
        msg.guild = true
      }

      if (event.message?.content) {
        msg.message = this.parseElements(event.message.content)
      }

      return msg
    }

    makeArray(msg, bot) {
      msg.self_id = bot.self_id
      msg.platform = bot.platform
      msg.bot = bot

      if (msg.message_type === "group" && msg.group_id) {
        msg.group = this.pickGroup({ bot }, msg.group_id)
      }

      if (msg.message_type === "private" && msg.user_id) {
        msg.friend = this.pickFriend({ bot }, msg.user_id)
      }

      return msg
    }

    makeMessage(data) {
      switch (data.message_type) {
        case "private":
          Bot.makeLog(
            "info",
            `好友消息：[${data.sender.nickname}] ${data.raw_message}`,
            `${data.self_id} <= ${data.user_id}`,
            true,
          )
          break
        case "group":
          const group_name = data.group_name || data.bot.gl.get(data.group_id)?.group_name
          const user_name = data.sender.card || data.sender.nickname
          Bot.makeLog(
            "info",
            `群消息：${group_name ? `[${group_name}, ${user_name}] ` : `[${user_name}] `}${data.raw_message}`,
            `${data.self_id} <= ${data.group_id}, ${data.user_id}`,
            true,
          )
          break
        default:
          Bot.makeLog("warn", `未知消息类型：${data.message_type}`, data.self_id)
      }

      Bot.em(`${data.post_type}.${data.message_type}`, data)
    }

    pickFriend(data, user_id) {
      const i = {
        ...data.bot.fl.get(user_id),
        ...data,
        user_id,
        channel_id: data.channel_id || user_id,
        self_id: data.bot.self_id,
      }
      return {
        ...i,
        sendMsg: msg => this.sendFriendMsg(i, msg),
        getInfo: () => this.getFriendInfo(i),
        getAvatarUrl() {
          return this.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user_id}`
        },
      }
    }

    pickMember(data, group_id, user_id) {
      const i = {
        ...data.bot.fl.get(user_id),
        ...data.bot.gml.get(group_id)?.get(user_id),
        ...data,
        group_id,
        user_id,
      }
      return {
        ...this.pickFriend(data, user_id),
        ...i,
        getInfo: () => this.getGroupMemberInfo(i),
      }
    }

    pickGroup(data, group_id) {
      const i = {
        ...data.bot.gl.get(group_id),
        ...data,
        group_id,
        channel_id: data.channel_id || group_id,
        self_id: data.bot.self_id,
      }
      return {
        ...i,
        sendMsg: msg => this.sendGroupMsg(i, msg),
        pickMember: user_id => this.pickMember(data, group_id, user_id),
        getInfo: () => this.getGroupInfo(i),
        getMemberList: () => this.getGroupMemberList(i),
      }
    }

    makeBot(login) {
      const bot = {
        uin: login.user?.id,
        self_id: login.user?.id,
        platform: login.platform || this.platform,
        status: login.status,
        adapter: this,
        stat: { sent: 0, recv: 0 },
        version: {
          id: this.id,
          name: this.name,
          version: "1.0.0",
        },
        fl: new Map(),
        gl: new Map(),
        gml: new Map(),
      }

      bot.sendApi = (method, params) => this.sendApi(method, params, bot.self_id)
      bot.sendFriendMsg = msg => this.sendFriendMsg({ ...msg, bot }, msg.message)
      bot.sendGroupMsg = msg => this.sendGroupMsg({ ...msg, bot }, msg.message)
      bot.sendGuildMsg = msg => this.sendGuildMsg({ ...msg, bot }, msg.message)
      bot.recallMsg = (channel_id, message_id) => this.recallMsg({ channel_id, bot }, message_id)
      bot.pickFriend = this.pickFriend.bind(this, { bot })
      bot.pickUser = bot.pickFriend
      bot.pickGroup = this.pickGroup.bind(this, { bot })
      bot.pickMember = this.pickMember.bind(this, { bot })

      bot.info = bot
      return bot
    }

    ensureBot(login) {
      if (!login || !login.user?.id) {
        return null
      }

      const selfId = login.user.id
      let bot = Bot.bots[selfId]

      if (!bot || bot.adapter !== this) {
        bot = this.makeBot(login)
        Bot.bots[bot.self_id] = bot
        Bot.uin.push(bot.self_id)
        Bot.emit("online", bot)
        Bot.makeLog("mark", `注册Satori bot: ${bot.self_id}`, "Satori")
      } else {
        // 更新现有bot的状态信息
        bot.status = login.status
        bot.platform = login.platform || this.platform
      }

      return bot
    }

    // WebSocket
    connectWebSocket() {
      if (this.ws) {
        this.ws.close()
      }

      Bot.makeLog("info", `Satori WebSocket: ${this.wsEndpoint}`, "Satori")
      if (this.token) {
        Bot.makeLog("info", `Satori token: ${this.token}`, "Satori")
      }

      this.ws = new WebSocket(this.wsEndpoint)

      this.ws.on("open", () => {
        Bot.makeLog("mark", "Satori WebSocket 连接成功", "Satori")

        const identifyBody = {
          sn: this.sessionSn,
        }

        if (this.token) {
          identifyBody.token = this.token
        }

        this.ws.send(
          JSON.stringify({
            op: 3, // IDENTIFY
            body: identifyBody,
          }),
        )

        this.startHeartbeat()
      })

      this.ws.on("message", data => {
        try {
          const message = JSON.parse(data.toString())
          this.handleWebSocketMessage(message)
        } catch (err) {
          Bot.makeLog("error", ["WebSocket 消息解析失败", err], "Satori")
        }
      })

      this.ws.on("close", (code, reason) => {
        Bot.makeLog("warn", `Satori WebSocket 连接关闭: ${code} ${reason}`, "Satori")
        this.stopHeartbeat()

        // 清理
        const botsToRemove = []
        for (const [self_id, bot] of Object.entries(Bot.bots)) {
          if (bot.adapter === this) {
            botsToRemove.push(self_id)
          }
        }

        for (const self_id of botsToRemove) {
          delete Bot.bots[self_id]
          const index = Bot.uin.indexOf(self_id)
          if (index > -1) {
            Bot.uin.splice(index, 1)
          }
          Bot.makeLog("mark", `${this.name}(${this.id}) 已断开`, `${self_id}`, true)
          Bot.emit("offline", { self_id })
        }

        // 重连
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            Bot.makeLog("info", "尝试重连 Satori WebSocket", "Satori")
            this.connectWebSocket()
          }
        }, 5000)
      })

      this.ws.on("error", err => {
        Bot.makeLog("error", ["Satori WebSocket 错误", err], "Satori")
      })
    }

    handleWebSocketMessage(message) {
      switch (message.op) {
        case 0: // EVENT
          if (message.body) {
            const event = message.body
            this.sessionSn = event.sn || this.sessionSn

            if (event.type?.startsWith("message-")) {
              const loginId = event.login?.user?.id
              let bot = Bot.bots[loginId]

              if (!bot || bot.adapter !== this) {
                if (event.login && event.login.user?.id) {
                  bot = this.ensureBot(event.login)
                } else {
                  const availableBots = Object.values(Bot.bots).filter(b => b.adapter === this)
                  if (availableBots.length > 0) {
                    bot = availableBots[0]
                  }
                }
              }

              if (bot && bot.adapter === this) {
                const yunzaiMsg = this.makeMsg(event)
                this.makeArray(yunzaiMsg, bot)
                this.makeMessage(yunzaiMsg)
              } else {
                Bot.makeLog(
                  "error",
                  [
                    "无法找到或创建对应的 bot 实例",
                    {
                      loginId,
                      eventType: event.type,
                      availableBots: Object.keys(Bot.bots).filter(
                        id => Bot.bots[id].adapter === this,
                      ),
                    },
                  ],
                  "Satori",
                )
              }
            }
          }
          break

        case 2: // PONG
          break

        case 4: // READY
          if (message.body?.logins) {
            const loginIds = []

            for (const login of message.body.logins) {
              if (login.user?.id) {
                const bot = this.ensureBot(login)
                if (bot) {
                  loginIds.push(bot.self_id)
                }
              }
            }

            // 将koishi沙盒排在第一个
            loginIds.sort((a, b) => {
              if (a === "koishi") return -1
              if (b === "koishi") return 1
              return 0
            })

            Bot.makeLog(
              "mark",
              `Satori WebSocket 已连接 ${loginIds.length} 个登录：${loginIds.join("、")}`,
              "Satori",
            )
          }
          break

        case 5: // META
          break
      }
    }

    startHeartbeat() {
      this.stopHeartbeat()
      this.heartbeatTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ op: 1 })) // PING
        }
      }, this.heartbeatInterval)
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
      }
    }
  })(),
)
