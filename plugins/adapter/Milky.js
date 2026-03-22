import cfg from "../../lib/config/config.js"
import util from "../../lib/util.js"
import fetch from "node-fetch"
import { WebSocket } from "ws"
import fs from "node:fs"
import YAML from "yaml"

Bot.adapter.push(
  new (class MilkyAdapter {
    id = "Milky"
    name = "Milky"
    version = "1.0.0"
    path = this.name

    load() {
      if (!cfg.milky?.enable) return

      let { host, port, prefix = "", connection } = cfg.milky
      this.defaultTimeout = (cfg.milky.http_timeout || 15) * 1000

      let protocol = "http"
      let wsProtocol = "ws"
      let cleanHost = host

      if (host.startsWith("https://")) {
        protocol = "https"
        wsProtocol = "wss"
        cleanHost = host.replace("https://", "")
      } else if (host.startsWith("http://")) {
        cleanHost = host.replace("http://", "")
      } else if (port === 443 || cfg.milky.ssl || cfg.milky.use_ssl) {
        protocol = "https"
        wsProtocol = "wss"
      }

      const baseUrl = cleanHost.includes(":")
        ? `${protocol}://${cleanHost}${prefix}`
        : `${protocol}://${cleanHost}:${port}${prefix}`
      const apiBaseUrl = `${baseUrl}/api`

      if (connection === "ws") {
        const wsUrl = cleanHost.includes(":")
          ? `${wsProtocol}://${cleanHost}${prefix}/event${cfg.milky.access_token ? `?access_token=${cfg.milky.access_token}` : ""}`
          : `${wsProtocol}://${cleanHost}:${port}${prefix}/event${cfg.milky.access_token ? `?access_token=${cfg.milky.access_token}` : ""}`
        setTimeout(() => this.connectWs(apiBaseUrl, wsUrl), 12000)
      } else if (connection === "webhook") {
        setTimeout(() => this.setupWebhook(apiBaseUrl), 12000)
      }
    }

    connectWs(apiBaseUrl, wsUrl) {
      const heartbeatInterval = (cfg.milky.ws?.heartbeat || 30) * 1000
      const reconnectInterval = (cfg.milky.ws?.reconnect_interval || 10) * 1000

      const connect = () => {
        const ws = new WebSocket(wsUrl)
        let heartbeat = null

        ws.on("open", () => {
          Bot.makeLog("debug", `WebSocket 已连接: ${wsUrl}`, "Milky")
          this.onConnect(ws, apiBaseUrl)

          heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.ping()
              } catch (err) {
                Bot.makeLog("error", `WebSocket 心跳失败: ${err.message}`, "Milky")
              }
            }
          }, heartbeatInterval)
        })

        ws.on("message", data => {
          try {
            const payload = JSON.parse(data)
            this.handleEvent(payload, ws, apiBaseUrl)
          } catch (err) {
            Bot.makeLog("error", `WebSocket 消息解析失败: ${err.message}`, "Milky")
          }
        })

        ws.on("close", () => {
          if (heartbeat) clearInterval(heartbeat)
          Bot.makeLog("warn", `WebSocket 已断开，${reconnectInterval / 1000}秒后重连...`, "Milky")
          setTimeout(connect, reconnectInterval)
        })

        ws.on("error", err => {
          Bot.makeLog("error", `WebSocket 错误: ${err.message}`, "Milky")
        })
      }

      connect()
    }

    setupWebhook(apiBaseUrl) {
      const path = cfg.milky.webhook?.path || "/milky"

      Bot.express.post(path, (req, res) => {
        try {
          this.handleEvent(req.body, null, apiBaseUrl)
          res.sendStatus(200)
        } catch (err) {
          Bot.makeLog("error", `Webhook 处理失败: ${err.message}`, "Milky")
          res.sendStatus(500)
        }
      })

      Bot.makeLog("mark", `Webhook 已设置在路径: ${path}`, "Milky")
      this.onConnect(null, apiBaseUrl)
    }

    async onConnect(ws, apiBaseUrl) {
      Bot.makeLog("debug", "正在初始化 Bot 信息...", "Milky")

      try {
        const loginInfo = await this.callApi(apiBaseUrl, cfg.milky.access_token, "get_login_info")
        if (loginInfo.retcode !== 0 || !loginInfo.data) {
          Bot.makeLog(
            "error",
            `获取登录信息失败: ${loginInfo.error || loginInfo.wording || "unknown error"}`,
            "Milky",
          )
          return
        }

        const self_id = String(loginInfo.data.uin || loginInfo.data.user_id)
        const exists = Boolean(Bot[self_id])

        if (exists) {
          Bot[self_id].ws = ws
          Bot[self_id].sendApi = (action, params) =>
            this.callApi(apiBaseUrl, cfg.milky.access_token, action, params)
          Bot[self_id].info = loginInfo.data
          Bot[self_id].nickname = loginInfo.data.nickname
          if (!Bot[self_id].stat) {
            Bot[self_id].stat = { start_time: Date.now() / 1000 }
          }
        } else {
          Bot[self_id] = {
            adapter: this,
            ws,
            sendApi: (action, params) =>
              this.callApi(apiBaseUrl, cfg.milky.access_token, action, params),
            info: loginInfo.data,
            get uin() {
              return this.info?.uin || this.info?.user_id
            },
            nickname: loginInfo.data.nickname,
            version: {
              id: "Milky",
              name: "Milky",
              version: `Milky v${this.version}`,
            },
            stat: {
              start_time: Date.now() / 1000,
            },
            fl: new Map(),
            gl: new Map(),
            gml: new Map(),
          }

          Object.defineProperty(Bot[self_id], "uin", {
            value: self_id,
            writable: true,
            enumerable: true,
            configurable: true,
          })

          if (!Bot.uin.includes(self_id)) Bot.uin.push(self_id)
        }

        this.attachBotMethods(self_id, apiBaseUrl, cfg.milky.access_token)

        if (!exists) {
          Bot[self_id].getFriendMap()
          Bot[self_id].getGroupMap()
        }

        this.syncImplInfo(self_id, exists ? "reconnect" : "connect")
        Bot.em(`connect.${self_id}`, { self_id, bot: Bot[self_id] })
      } catch (err) {
        Bot.makeLog("error", `v${this.version} 初始化失败: ${err.stack || err.message}`, "Milky")
      }
    }

    attachBotMethods(self_id, apiBaseUrl, token) {
      const bot = Bot[self_id]
      const ctx = extra => ({ self_id, bot, ...extra })

      bot.sendApi = (action, params) => this.callApi(apiBaseUrl, token, action, params)

      Object.assign(bot, {
        send_private_msg: (user_id, msg) => this.sendPrivateMsg(ctx({ user_id }), msg),
        send_group_msg: (group_id, msg) => this.sendGroupMsg(ctx({ group_id }), msg),

        send_private_forward_msg: (user_id, msg) =>
          this.sendPrivateForwardMsg(ctx({ user_id }), msg),
        sendFriendForwardMsg: (user_id, msg) => this.sendPrivateForwardMsg(ctx({ user_id }), msg),
        send_group_forward_msg: (group_id, msg) => this.sendGroupForwardMsg(ctx({ group_id }), msg),
        sendGroupForwardMsg: (group_id, msg) => this.sendGroupForwardMsg(ctx({ group_id }), msg),

        pickFriend: user_id => this.pickFriend(ctx({}), user_id),
        pickGroup: group_id => this.pickGroup(ctx({}), group_id),
        pickMember: (group_id, user_id) => this.pickMember(ctx({}), group_id, user_id),

        getFriendMap: () => this.getFriendMap(ctx({})),
        getGroupMap: () => this.getGroupMap(ctx({})),
        getMemberMap: group_id => this.getMemberMap(ctx({ group_id })),

        get_friend_list: () => this.getFriendList(ctx({})),
        get_friend_info: user_id => this.getFriendInfo(ctx({ user_id })),
        get_group_list: () => this.getGroupList(ctx({})),
        get_group_info: group_id => this.getGroupInfo(ctx({ group_id })),
        get_group_member_list: group_id => this.getMemberList(ctx({ group_id })),
        get_group_member_info: (group_id, user_id) =>
          this.getMemberInfo(ctx({ group_id, user_id })),

        get_impl_info: () => this.callApi(apiBaseUrl, token, "get_impl_info"),
        get_user_profile: user_id => this.getProfile(ctx({ user_id })),
        set_bio: new_bio => this.setBio(ctx({}), new_bio),

        send_friend_nudge: user_id => this.sendFriendNudge(ctx({ user_id })),
        send_group_nudge: (group_id, user_id) => this.sendGroupNudge(ctx({ group_id, user_id })),
        send_group_message_reaction: (group_id, message_seq, reaction, is_add) =>
          this.sendGroupMessageReaction(ctx({ group_id, message_seq }), reaction, is_add),

        set_group_essence_message: (group_id, message_seq, is_set) =>
          this.setGroupEssenceMessage(ctx({ group_id, message_seq }), is_set),
        get_group_essence_messages: (group_id, page_index, page_size) =>
          this.getGroupEssenceMessages(ctx({ group_id }), page_index, page_size),

        send_group_announcement: (group_id, content, image_uri) =>
          this.sendGroupAnnouncement(ctx({ group_id }), content, image_uri),
        get_group_announcements: group_id => this.getGroupAnnouncements(ctx({ group_id })),

        accept_friend_request: (initiator_uid, is_filtered) =>
          this.acceptFriendRequest(ctx({}), initiator_uid, is_filtered),
        reject_friend_request: (initiator_uid, is_filtered, reason) =>
          this.rejectFriendRequest(ctx({}), initiator_uid, is_filtered, reason),

        accept_group_request: (notification_seq, notification_type, group_id, is_filtered) =>
          this.acceptGroupRequest(
            ctx({}),
            notification_seq,
            notification_type,
            group_id,
            is_filtered,
          ),
        reject_group_request: (
          notification_seq,
          notification_type,
          group_id,
          is_filtered,
          reason,
        ) =>
          this.rejectGroupRequest(
            ctx({}),
            notification_seq,
            notification_type,
            group_id,
            is_filtered,
            reason,
          ),

        accept_group_invitation: (group_id, invitation_seq) =>
          this.acceptGroupInvitation(ctx({}), group_id, invitation_seq),
        reject_group_invitation: (group_id, invitation_seq) =>
          this.rejectGroupInvitation(ctx({}), group_id, invitation_seq),

        recall_group_message: (group_id, message_seq) =>
          this.recallGroupMsg(ctx({ group_id }), message_seq),
        recall_private_message: (user_id, message_seq) =>
          this.recallPrivateMsg(ctx({ user_id }), message_seq),
        delete_msg: message_id => this.deleteMsg(ctx({}), message_id),
        get_msg: (message_scene, peer_id, message_seq) =>
          this.getMsg(ctx({ message_scene, peer_id, message_seq })),
        get_history_messages: (message_scene, peer_id, start_message_seq, limit) =>
          this.getHistoryMessages(ctx({ message_scene, peer_id, start_message_seq, limit })),
        mark_message_as_read: (message_scene, peer_id, message_seq) =>
          this.markMessageAsRead(ctx({}), message_scene, peer_id, message_seq),

        set_group_name: (group_id, group_name) => this.setGroupName(ctx({ group_id }), group_name),
        set_group_card: (group_id, user_id, card) =>
          this.setGroupCard(ctx({ group_id }), user_id, card),
        set_group_admin: (group_id, user_id, enable) =>
          this.setGroupAdmin(ctx({ group_id }), user_id, enable),
        set_group_special_title: (group_id, user_id, title) =>
          this.setGroupSpecialTitle(ctx({ group_id }), user_id, title),
        set_group_ban: (group_id, user_id, duration) =>
          this.setGroupBan(ctx({ group_id }), user_id, duration),
        set_group_whole_ban: (group_id, enable) => this.setGroupWholeBan(ctx({ group_id }), enable),
        set_group_kick: (group_id, user_id) => this.setGroupKick(ctx({ group_id }), user_id),
        set_group_leave: group_id => this.setGroupLeave(ctx({ group_id })),

        send_like: (user_id, times) => this.sendLike(ctx({}), user_id, times),
        delete_friend: user_id => this.deleteFriend(ctx({}), user_id),

        upload_group_file: (group_id, file, folder, name) =>
          this.uploadGroupFile(ctx({ group_id }), file, folder, name),
        delete_group_file: (group_id, file_id) => this.deleteGroupFile(ctx({ group_id }), file_id),
        get_group_files: (group_id, folder_id) =>
          this.getGroupFilesList(ctx({ group_id }), folder_id),
        create_group_folder: (group_id, name) =>
          this.createGroupFileFolder(ctx({ group_id }), name),
        delete_group_folder: (group_id, folder_id) =>
          this.deleteGroupFileFolder(ctx({ group_id }), folder_id),
      })

      if (!Object.getOwnPropertyDescriptor(bot, "pickUser")) {
        Object.defineProperty(bot, "pickUser", {
          get() {
            return this.pickFriend
          },
        })
      }
    }

    async syncImplInfo(self_id, type = "connect") {
      try {
        const impl = await Bot[self_id].get_impl_info()
        if (impl.retcode === 0 && impl.data) {
          const name = impl.data.impl_name || "Milky"
          const version = impl.data.impl_version || this.version
          Bot[self_id].version = {
            id: name,
            name: "Milky",
            version: `${name} v${version}`,
          }
          delete Bot[self_id].apk

          if (type === "connect") {
            Bot.makeLog(
              "mark",
              `MilkyAdapter v${this.version} [${name} v${version}] ${Bot[self_id].nickname}(${self_id}) 已连接`,
              self_id,
            )
          } else {
            Bot.makeLog(
              "mark",
              `MilkyAdapter v${this.version} [${name} v${version}] ${Bot[self_id].nickname}(${self_id}) 已重连`,
              self_id,
            )
          }
          return
        }
      } catch {}

      if (type === "connect") {
        Bot.makeLog(
          "mark",
          `MilkyAdapter v${this.version} ${Bot[self_id].nickname}(${self_id}) 已连接`,
          self_id,
        )
      } else {
        Bot.makeLog(
          "mark",
          `MilkyAdapter v${this.version} ${Bot[self_id].nickname}(${self_id}) 已重连`,
          self_id,
        )
      }
    }

    async callApi(apiBaseUrl, token, action, params = {}) {
      const url = `${apiBaseUrl}/${action}`
      const headers = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.defaultTimeout)

      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(params || {}),
          signal: controller.signal,
        })

        let data = null
        try {
          data = await res.json()
        } catch (err) {
          return this.makeApiError(action, `响应解析失败: ${err.message}`, {
            http_status: res.status,
          })
        }

        if (!res.ok) {
          return this.makeApiError(action, `HTTP ${res.status}`, {
            http_status: res.status,
            data,
          })
        }

        if (!data || typeof data !== "object") {
          return this.makeApiError(action, "响应格式非法", {
            http_status: res.status,
          })
        }

        if (typeof data.retcode === "undefined") {
          data.retcode = 0
        }
        if (!data.status) {
          data.status = data.retcode === 0 ? "ok" : "failed"
        }
        if (typeof data.error === "undefined" && data.retcode !== 0) {
          data.error = data.wording || "unknown error"
        }

        return data
      } catch (err) {
        if (err.name === "AbortError") {
          return this.makeApiError(action, `请求超时(${this.defaultTimeout}ms)`)
        }
        return this.makeApiError(action, err.message)
      } finally {
        clearTimeout(timer)
      }
    }

    makeApiError(action, error, extra = {}) {
      return {
        retcode: -1,
        status: "failed",
        action,
        data: null,
        error,
        wording: error,
        ...extra,
      }
    }

    async execApi(data, action, params = {}, options = {}) {
      const { logSuccess = null, logFail = null, logUin = data?.self_id, silent = false } = options

      if (logSuccess) {
        Bot.makeLog("info", logSuccess, logUin, true)
      }

      const ret = await data.bot.sendApi(action, params)

      if (ret.retcode !== 0 && !silent) {
        Bot.makeLog("error", logFail || `${action} 调用失败: ${JSON.stringify(ret)}`, data.self_id)
      }

      return ret
    }

    handleEvent(data, ws, apiBaseUrl) {
      if (!data?.event_type) {
        Bot.makeLog("debug", `收到未知数据: ${JSON.stringify(data)}`, "Milky")
        return
      }

      Bot.makeLog("debug", `收到事件: ${data.event_type}`, "Milky")

      const event = {
        ...(data.data || {}),
        event_type: data.event_type,
        raw: data,
      }

      event.self_id = String(data.self_id || Bot.uin[0])
      event.bot = Bot[event.self_id]

      if (!event.bot) {
        Bot.makeLog("warn", `收到事件但 Bot 尚未初始化: ${event.self_id}`, "Milky")
        return
      }

      switch (data.event_type) {
        case "message_receive":
          this.makeMessage(event)
          break

        case "message_recall":
        case "friend_nudge":
        case "group_nudge":
        case "group_admin_change":
        case "group_member_increase":
        case "group_member_decrease":
        case "group_name_change":
        case "group_message_reaction":
        case "group_mute":
        case "group_whole_mute":
        case "group_essence_message_change":
        case "friend_file_upload":
          this.makeNotice(event)
          break

        case "friend_request":
        case "group_join_request":
        case "group_invited_join_request":
        case "group_invitation":
          this.makeRequest(event)
          break
      }
    }

    makeMessage(data) {
      data.post_type = "message"
      data.message_type = data.message_scene === "group" ? "group" : "private"
      data.user_id = String(data.sender_id)
      if (data.message_type === "group") data.group_id = String(data.peer_id)
      data.message_id = String(data.message_seq)

      delete data.group
      delete data.group_member
      delete data.friend

      data.message = this.parseMsg(data.segments)
      data.raw_message = data.message
        .map(m => (m.type === "text" ? m.text : `[${m.type}]`))
        .join("")

      const group_name = data.group_id ? data.bot.gl.get(data.group_id)?.group_name : null
      let user_name = data.bot.fl.get(data.user_id)?.nickname

      data.sender = {
        user_id: Number(data.user_id),
        nickname: user_name || "",
        sub_type: data.message_type,
      }

      if (data.message_type === "group") {
        const member = data.bot.gml.get(data.group_id)?.get(data.user_id)
        if (member) {
          Object.assign(data.sender, {
            ...member,
            user_id: Number(member.user_id),
          })
          user_name = member.card || member.nickname || user_name
        }
      }

      const logMsg = data.raw_message.replace(/base64:\/\/([^"]+)/g, "base64://...")
      if (data.message_type === "group") {
        const logUin = `${data.self_id} <= ${data.group_id}, ${data.user_id}`
        Bot.makeLog(
          "info",
          `群消息：[${group_name || data.group_id}, ${user_name || data.user_id}] ${logMsg}`,
          logUin,
        )
      } else {
        const logUin = `${data.self_id} <= ${data.user_id}`
        Bot.makeLog("info", `好友消息：[${user_name || data.user_id}] ${logMsg}`, logUin)
      }

      Bot.em(`${data.post_type}.${data.message_type}.normal`, data)
    }

    makeNotice(data) {
      data.post_type = "notice"

      switch (data.event_type) {
        case "message_recall":
          data.notice_type = data.message_scene === "group" ? "group_recall" : "friend_recall"
          data.group_id = data.message_scene === "group" ? String(data.peer_id) : undefined
          data.operator_id = String(data.operator_id)
          data.user_id = String(data.sender_id)
          data.message_id = String(data.message_seq)
          if (data.message_scene === "group") {
            Bot.makeLog(
              "info",
              `群消息撤回：${data.operator_id} => ${data.user_id} ${data.message_id}`,
              `${data.self_id} <= ${data.group_id}`,
              true,
            )
          } else {
            Bot.makeLog(
              "info",
              `好友消息撤回：${data.message_id}`,
              `${data.self_id} <= ${data.user_id}`,
              true,
            )
          }
          break

        case "friend_nudge":
          data.notice_type = "notify"
          data.sub_type = "poke"
          data.user_id = String(data.user_id)
          data.operator_id = data.is_self_send ? data.self_id : data.user_id
          data.target_id = data.is_self_receive ? data.self_id : data.user_id
          Bot.makeLog(
            "info",
            `好友戳一戳：[${data.operator_id} => ${data.target_id}]`,
            data.self_id,
          )
          break

        case "group_nudge":
          data.notice_type = "notify"
          data.sub_type = "poke"
          data.group_id = String(data.group_id)
          data.operator_id = String(data.sender_id)
          data.target_id = String(data.receiver_id)
          data.user_id = data.operator_id
          Bot.makeLog(
            "info",
            `群戳一戳：[${data.group_id}: ${data.operator_id} => ${data.target_id}]`,
            data.self_id,
          )
          break

        case "group_admin_change":
          data.notice_type = "group_admin"
          data.sub_type = data.is_set ? "set" : "unset"
          data.group_id = String(data.group_id)
          data.user_id = String(data.user_id)
          Bot.makeLog(
            "info",
            `群管理员变更：${data.user_id} ${data.sub_type}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_member_increase":
          data.notice_type = "group_increase"
          data.sub_type = data.invitor_id ? "invite" : "approve"
          data.group_id = String(data.group_id)
          data.user_id = String(data.user_id)
          data.operator_id = String(data.operator_id || data.invitor_id)
          Bot.makeLog(
            "info",
            `群成员增加：${data.operator_id} => ${data.user_id} ${data.sub_type}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_member_decrease":
          data.notice_type = "group_decrease"
          data.sub_type = data.operator_id
            ? data.operator_id == data.user_id
              ? "leave"
              : "kick"
            : "leave"
          data.group_id = String(data.group_id)
          data.user_id = String(data.user_id)
          data.operator_id = String(data.operator_id || data.user_id)
          Bot.makeLog(
            "info",
            `群成员减少：${data.operator_id} => ${data.user_id} ${data.sub_type}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_mute":
          data.notice_type = "group_ban"
          data.sub_type = data.duration > 0 ? "ban" : "lift_ban"
          data.group_id = String(data.group_id)
          data.user_id = String(data.user_id)
          data.operator_id = String(data.operator_id)
          data.duration = data.duration || 0
          Bot.makeLog(
            "info",
            `群禁言：${data.operator_id} => ${data.user_id} ${data.sub_type} ${data.duration}秒`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_whole_mute":
          data.notice_type = "group_ban"
          data.sub_type = data.is_mute ? "ban" : "lift_ban"
          data.group_id = String(data.group_id)
          data.user_id = "0"
          data.operator_id = String(data.operator_id)
          Bot.makeLog(
            "info",
            `全员禁言：${data.operator_id} ${data.sub_type}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_message_reaction":
          data.notice_type = "group_msg_emoji_like"
          data.group_id = String(data.group_id)
          data.user_id = String(data.user_id)
          data.message_id = String(data.message_seq)
          data.likes = [{ emoji_id: String(data.face_id), count: data.is_add ? 1 : 0 }]
          Bot.makeLog(
            "info",
            [`群消息回应：${data.message_id}`, data.likes],
            `${data.self_id} <= ${data.group_id}, ${data.user_id}`,
            true,
          )
          break

        case "group_name_change":
          data.notice_type = "group_card"
          data.group_id = String(data.group_id)
          data.user_id = String(data.operator_id)
          Bot.makeLog(
            "info",
            `群名变更：${data.old_name} => ${data.new_name}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "group_essence_message_change":
          data.notice_type = "group_essence"
          data.sub_type = data.is_set ? "add" : "delete"
          data.group_id = String(data.group_id)
          data.operator_id = String(data.operator_id)
          data.message_id = String(data.message_seq)
          Bot.makeLog(
            "info",
            `群精华消息：${data.operator_id} ${data.sub_type} ${data.message_id}`,
            `${data.self_id} <= ${data.group_id}`,
            true,
          )
          break

        case "friend_file_upload":
          data.notice_type = "offline_file"
          data.user_id = String(data.user_id)
          data.file = {
            name: data.file_name,
            size: data.file_size,
            url: data.file_id,
          }
          Bot.makeLog(
            "info",
            `好友文件上传：${data.file_name}`,
            `${data.self_id} <= ${data.user_id}`,
            true,
          )
          break

        default:
          data.notice_type = data.event_type
          break
      }

      if (data.notice_type !== "notify") {
        let notice = data.notice_type.split("_")
        data.notice_type = notice.shift()
        notice = notice.join("_")
        if (notice) data.sub_type = notice
      }

      Bot.em(`${data.post_type}.${data.notice_type}.${data.sub_type || ""}`, data)
    }

    makeRequest(data) {
      data.post_type = "request"

      if (data.event_type === "friend_request") {
        data.request_type = "friend"
        data.sub_type = "add"
        data.user_id = String(data.initiator_id)
        data.comment = data.comment
        data.flag = data.initiator_uid
        Bot.makeLog(
          "info",
          `加好友请求：${data.comment}(${data.flag})`,
          `${data.self_id} <= ${data.user_id}`,
          true,
        )
        data.approve = approve =>
          approve
            ? data.bot.accept_friend_request(data.flag)
            : data.bot.reject_friend_request(data.flag)
      } else if (data.event_type === "group_invitation") {
        data.request_type = "group"
        data.sub_type = "invite"
        data.group_id = String(data.group_id)
        data.user_id = String(data.initiator_id)
        data.flag = String(data.invitation_seq)
        Bot.makeLog(
          "info",
          `入群邀请：${data.group_id} 来自 ${data.user_id} (${data.flag})`,
          `${data.self_id} <= ${data.group_id}`,
          true,
        )
        data.approve = approve =>
          approve
            ? data.bot.accept_group_invitation(data.group_id, data.flag)
            : data.bot.reject_group_invitation(data.group_id, data.flag)
      } else {
        data.request_type = "group"
        data.sub_type = data.event_type === "group_join_request" ? "add" : "invite"
        data.group_id = String(data.group_id)
        data.user_id = String(data.initiator_id)
        data.comment = data.comment
        data.flag = String(data.notification_seq)
        Bot.makeLog(
          "info",
          `加群请求：${data.sub_type} ${data.comment}(${data.flag})`,
          `${data.self_id} <= ${data.group_id}, ${data.user_id}`,
          true,
        )
        data.approve = approve =>
          approve
            ? data.bot.accept_group_request(
                data.flag,
                data.sub_type === "add" ? "join_request" : "invited_join_request",
                data.group_id,
              )
            : data.bot.reject_group_request(
                data.flag,
                data.sub_type === "add" ? "join_request" : "invited_join_request",
                data.group_id,
              )
      }

      Bot.em(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
    }

    parseMsg(message) {
      if (!Array.isArray(message)) return []

      return message.map(m => {
        const type = String(m.type || "").toLowerCase()
        const d = m.data || {}

        switch (type) {
          case "text":
            return { type: "text", text: d.text }

          case "face_incoming":
          case "face":
            return { type: "face", id: d.face_id }

          case "image":
            return { type: "image", url: d.temp_url || d.url || d.file_path }

          case "record":
          case "audio":
            return { type: "record", url: d.temp_url || d.url }

          case "video":
            return { type: "video", url: d.temp_url || d.url }

          case "mention":
            return { type: "at", qq: String(d.user_id) }

          case "mention_all":
            return { type: "at", qq: "all" }

          case "reply":
            return { type: "reply", id: String(d.message_seq) }

          case "forward":
            return { type: "forward", id: d.forward_id }

          case "file":
            return { type: "file", file: d.file_id, name: d.file_name, size: d.file_size }

          case "market_face":
            return { type: "face", id: d.emoji_id, name: d.summary }

          case "light_app":
            return { type: "json", data: d.json_payload }

          case "xml":
            return { type: "xml", data: d.xml_payload }

          default:
            return { type: "text", text: `[${m.type}]` }
        }
      })
    }

    fixUri(uri) {
      if (!uri) return uri

      if (Buffer.isBuffer(uri)) {
        return `base64://${uri.toString("base64")}`
      }

      if (typeof uri === "object" && uri.type === "Buffer" && Array.isArray(uri.data)) {
        return `base64://${Buffer.from(uri.data).toString("base64")}`
      }

      if (typeof uri !== "string") return uri

      let res = uri
      if (res.startsWith("base64://")) {
        const data = res.substring(9)
        const pad = data.length % 4
        if (pad > 0) {
          res += "=".repeat(4 - pad)
        }
        return res
      }

      if (/^[a-zA-Z]:(\\|\/)/.test(res) || (res.startsWith("/") && !res.startsWith("//"))) {
        return `file://${res}`
      }

      return res
    }

    async makeMsg(msg) {
      if (!Array.isArray(msg)) msg = [msg]

      const message = []
      const forward = []

      for (let i of msg) {
        if (typeof i !== "object" || i === null) i = { type: "text", text: String(i) }

        const type = i.type

        switch (type) {
          case "text":
            message.push({ type: "text", data: { text: i.text } })
            break

          case "at":
            if (i.qq === "all") {
              message.push({ type: "mention_all", data: {} })
            } else {
              message.push({ type: "mention", data: { user_id: Number(i.qq) } })
            }
            break

          case "face":
            message.push({ type: "face", data: { face_id: String(i.id) } })
            break

          case "image":
            message.push({
              type: "image",
              data: { uri: this.fixUri(i.file || i.url), sub_type: "normal" },
            })
            break

          case "record":
          case "audio":
            message.push({ type: "record", data: { uri: this.fixUri(i.file || i.url) } })
            break

          case "video":
            message.push({
              type: "video",
              data: { uri: this.fixUri(i.file || i.url), thumb_uri: this.fixUri(i.thumb) },
            })
            break

          case "reply":
            message.push({ type: "reply", data: { message_seq: Number(i.id) } })
            break

          case "node":
            forward.push(...(Array.isArray(i.data) ? i.data : [i.data || i]))
            break

          case "file":
            message.push({ type: "file", data: { file_id: i.file } })
            break

          case "market_face":
            message.push({
              type: "market_face",
              data: {
                emoji_id: i.id,
                emoji_package_id: i.package_id || 0,
                key: i.key,
                summary: i.name,
              },
            })
            break

          case "light_app":
            message.push({
              type: "light_app",
              data: {
                app_name: i.app_name || "Yunzai",
                json_payload: i.data,
              },
            })
            break

          case "xml":
            message.push({
              type: "xml",
              data: {
                service_id: i.service_id || 1,
                xml_payload: i.data,
              },
            })
            break

          case "json":
            message.push({
              type: "light_app",
              data: {
                app_name: i.app_name || "Yunzai",
                json_payload: i.data,
              },
            })
            break

          case "forward":
            forward.push(i)
            break

          default:
            if (typeof i.text !== "undefined") {
              message.push({ type: "text", data: { text: String(i.text) } })
            }
            break
        }
      }

      return [message, forward]
    }

    async makeForwardMsg(msg) {
      const messages = []

      for (const item of msg) {
        const [segments, forward] = await this.makeMsg(item.message || item)

        if (forward.length) {
          const nested = await this.makeForwardMsg(forward)
          messages.push(...nested[0].data.messages)
        }

        if (segments.length) {
          let uin = item.user_id || item.uin || (Bot.uin && Bot.uin[0]) || 80000000
          let user_id = Number(uin)
          if (isNaN(user_id) || user_id === 0) user_id = 80000000

          const nickname = item.nickname || item.sender_name || item.name || "机器人"

          messages.push({
            user_id,
            uin: String(user_id),
            sender_name: nickname,
            nickname,
            segments,
            message: segments,
            avatar_url: `https://q.qlogo.cn/g?b=qq&s=0&nk=${user_id}`,
            time: Number(item.time) || Math.floor(Date.now() / 1000),
          })
        }
      }

      return [
        {
          type: "forward",
          data: { messages },
        },
      ]
    }

    getTargetLogInfo(data, scene) {
      if (scene === "group") {
        const group_name = data.bot.gl.get(String(data.group_id))?.group_name
        return {
          targetName: group_name || data.group_id,
          logUin: `${data.self_id} => ${data.group_id}`,
        }
      }

      const user_name = data.bot.fl.get(String(data.user_id))?.nickname
      return {
        targetName: user_name || data.user_id,
        logUin: `${data.self_id} => ${data.user_id}`,
      }
    }

    async sendMsg(data, scene, msg) {
      const [message, forward] = await this.makeMsg(msg)
      let res

      if (forward.length) {
        res =
          scene === "group"
            ? await this.sendGroupForwardMsg(data, forward)
            : await this.sendPrivateForwardMsg(data, forward)
      }

      if (!message.length) return res

      const logMsg = Bot.String(msg).replace(/base64:\/\/([^"]+)/g, "base64://...")
      const { targetName, logUin } = this.getTargetLogInfo(data, scene)

      const action = scene === "group" ? "send_group_message" : "send_private_message"
      const params =
        scene === "group"
          ? { group_id: Number(data.group_id), message }
          : { user_id: Number(data.user_id), message }

      return this.execApi(data, action, params, {
        logSuccess:
          scene === "group"
            ? `发送群消息：[${targetName}] ${logMsg}`
            : `发送好友消息：[${targetName}] ${logMsg}`,
        logFail: scene === "group" ? `发送群消息失败` : `发送好友消息失败`,
        logUin,
      })
    }

    async sendForwardMsg(data, scene, msg) {
      const message = await this.makeForwardMsg(msg)
      const { targetName, logUin } = this.getTargetLogInfo(data, scene)

      const action = scene === "group" ? "send_group_message" : "send_private_message"
      const params =
        scene === "group"
          ? { group_id: Number(data.group_id), message }
          : { user_id: Number(data.user_id), message }

      return this.execApi(data, action, params, {
        logSuccess:
          scene === "group"
            ? `发送群合并转发消息：[${targetName}]`
            : `发送好友合并转发消息：[${targetName}]`,
        logFail: scene === "group" ? `发送群合并转发消息失败` : `发送好友合并转发消息失败`,
        logUin,
      })
    }

    async sendPrivateMsg(data, msg) {
      return this.sendMsg(data, "private", msg)
    }

    async sendGroupMsg(data, msg) {
      return this.sendMsg(data, "group", msg)
    }

    async sendPrivateForwardMsg(data, msg) {
      return this.sendForwardMsg(data, "private", msg)
    }

    async sendGroupForwardMsg(data, msg) {
      return this.sendForwardMsg(data, "group", msg)
    }

    pickFriend(data, user_id) {
      const i = { ...data, user_id: String(user_id) }

      return {
        ...i,
        sendMsg: msg => this.sendPrivateMsg(i, msg),
        sendForwardMsg: msg => this.sendPrivateForwardMsg(i, msg),
        recallMsg: message_id => this.recallPrivateMsg(i, message_id),
        getInfo: () => this.getFriendInfo(i),
        poke: () => this.sendFriendNudge(i),
        thumbUp: times => this.sendLike(i, user_id, times),
        delete: () => this.deleteFriend(i, user_id),
        getMsg: message_seq =>
          this.getMsg({ ...i, message_scene: "private", peer_id: Number(user_id), message_seq }),
        getHistory: (start_message_seq, limit = 20) =>
          this.getHistoryMessages({
            ...i,
            message_scene: "private",
            peer_id: Number(user_id),
            start_message_seq,
            limit,
          }),
        getAvatarUrl: () => `https://q.qlogo.cn/g?b=qq&s=0&nk=${user_id}`,
      }
    }

    pickGroup(data, group_id) {
      const i = { ...data, group_id: String(group_id) }

      return {
        ...i,
        sendMsg: msg => this.sendGroupMsg(i, msg),
        sendForwardMsg: msg => this.sendGroupForwardMsg(i, msg),
        recallMsg: message_id => this.recallGroupMsg(i, message_id),
        pickMember: user_id => this.pickMember(i, group_id, user_id),
        getInfo: () => this.getGroupInfo(i),
        getMemberMap: () => this.getMemberMap(i),
        getMemberList: () => this.getMemberList(i),
        poke: user_id => this.sendGroupNudge({ ...i, user_id }),
        pokeMember: user_id => this.sendGroupNudge({ ...i, user_id }),
        addEssence: message_seq => this.setGroupEssenceMessage({ ...i, message_seq }, true),
        removeEssence: message_seq => this.setGroupEssenceMessage({ ...i, message_seq }, false),
        getEssence: (page = 0, size = 50) => this.getGroupEssenceMessages(i, page, size),
        getMsg: message_seq =>
          this.getMsg({ ...i, message_scene: "group", peer_id: Number(group_id), message_seq }),
        getHistory: (start_message_seq, limit = 20) =>
          this.getHistoryMessages({
            ...i,
            message_scene: "group",
            peer_id: Number(group_id),
            start_message_seq,
            limit,
          }),
        setName: name => this.setGroupName(i, name),
        muteMember: (user_id, duration) => this.setGroupBan(i, user_id, duration),
        kickMember: user_id => this.setGroupKick(i, user_id),
        setWholeBan: enable => this.setGroupWholeBan(i, enable),
        quit: () => this.setGroupLeave(i),
        sendFile: (file, name) => this.uploadGroupFile(i, file, "/", name),
        fs: {
          upload: (file, folder = "/", name) => this.uploadGroupFile(i, file, folder, name),
          rm: file_id => this.deleteGroupFile(i, file_id),
          ls: (folder_id = "/") => this.getGroupFilesList(i, folder_id),
          mkdir: name => this.createGroupFileFolder(i, name),
          rmdir: folder_id => this.deleteGroupFileFolder(i, folder_id),
        },
        getAvatarUrl: () => `https://p.qlogo.cn/gh/${group_id}/${group_id}/0`,
      }
    }

    pickMember(data, group_id, user_id) {
      const i = { ...data, group_id: String(group_id), user_id: String(user_id) }

      return {
        ...i,
        ...this.pickFriend(data, user_id),
        group_id: String(group_id),
        getInfo: () => this.getMemberInfo(i),
        poke: () => this.sendGroupNudge(i),
        mute: duration => this.setGroupBan(i, user_id, duration),
        kick: () => this.setGroupKick(i, user_id),
        setCard: card => this.setGroupCard(i, user_id, card),
        setAdmin: enable => this.setGroupAdmin(i, user_id, enable),
        setTitle: title => this.setGroupSpecialTitle(i, user_id, title),
        getAvatarUrl: () => `https://q.qlogo.cn/g?b=qq&s=0&nk=${user_id}`,
        get is_friend() {
          return data.bot.fl.has(String(user_id))
        },
        get is_owner() {
          return this.role === "owner"
        },
        get is_admin() {
          return this.role === "admin" || this.is_owner
        },
      }
    }

    async recallGroupMsg(data, message_id) {
      return this.execApi(
        data,
        "recall_group_message",
        {
          group_id: Number(data.group_id),
          message_seq: Number(message_id),
        },
        {
          logSuccess: `撤回群消息：[${data.group_id}] ${message_id}`,
          logUin: data.self_id,
        },
      )
    }

    async recallPrivateMsg(data, message_id) {
      return this.execApi(
        data,
        "recall_private_message",
        {
          user_id: Number(data.user_id),
          message_seq: Number(message_id),
        },
        {
          logSuccess: `撤回好友消息：${message_id}`,
          logUin: `${data.self_id} => ${data.user_id}`,
        },
      )
    }

    async deleteMsg(data, message_id) {
      return this.execApi(
        data,
        "recall_group_message",
        {
          message_seq: Number(message_id),
        },
        {
          logSuccess: `撤回消息：${message_id}`,
          logUin: data.self_id,
        },
      )
    }

    async markMessageAsRead(data, message_scene, peer_id, message_seq) {
      return this.execApi(
        data,
        "mark_message_as_read",
        {
          message_scene,
          peer_id: Number(peer_id),
          message_seq: Number(message_seq),
        },
        {
          silent: true,
        },
      )
    }

    async setGroupName(data, group_name) {
      return this.execApi(
        data,
        "set_group_name",
        {
          group_id: Number(data.group_id),
          new_group_name: group_name,
        },
        {
          logSuccess: `设置群名：${group_name}`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async setGroupCard(data, user_id, card) {
      return this.execApi(
        data,
        "set_group_member_card",
        {
          group_id: Number(data.group_id),
          user_id: Number(user_id),
          card,
        },
        {
          logSuccess: `设置群名片：${card}`,
          logUin: `${data.self_id} => ${data.group_id}, ${user_id}`,
        },
      )
    }

    async setGroupAdmin(data, user_id, enable = true) {
      return this.execApi(
        data,
        "set_group_member_admin",
        {
          group_id: Number(data.group_id),
          user_id: Number(user_id),
          is_set: enable,
        },
        {
          logSuccess: `${enable ? "设置" : "取消"}群管理员`,
          logUin: `${data.self_id} => ${data.group_id}, ${user_id}`,
        },
      )
    }

    async setGroupSpecialTitle(data, user_id, title) {
      return this.execApi(
        data,
        "set_group_member_special_title",
        {
          group_id: Number(data.group_id),
          user_id: Number(user_id),
          special_title: title,
        },
        {
          logSuccess: `设置群头衔：${title}`,
          logUin: `${data.self_id} => ${data.group_id}, ${user_id}`,
        },
      )
    }

    async setGroupBan(data, user_id, duration = 1800) {
      return this.execApi(
        data,
        "set_group_member_mute",
        {
          group_id: Number(data.group_id),
          user_id: Number(user_id),
          duration: Number(duration),
        },
        {
          logSuccess: `禁言群成员：${duration}秒`,
          logUin: `${data.self_id} => ${data.group_id}, ${user_id}`,
        },
      )
    }

    async setGroupWholeBan(data, enable = true) {
      return this.execApi(
        data,
        "set_group_whole_mute",
        {
          group_id: Number(data.group_id),
          is_mute: enable,
        },
        {
          logSuccess: `${enable ? "开启" : "关闭"}全员禁言`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async setGroupKick(data, user_id) {
      return this.execApi(
        data,
        "kick_group_member",
        {
          group_id: Number(data.group_id),
          user_id: Number(user_id),
        },
        {
          logSuccess: `踢出群成员`,
          logUin: `${data.self_id} => ${data.group_id}, ${user_id}`,
        },
      )
    }

    async setGroupLeave(data) {
      return this.execApi(
        data,
        "leave_group",
        {
          group_id: Number(data.group_id),
        },
        {
          logSuccess: `退群`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async sendLike(data, user_id, times = 1) {
      return this.execApi(
        data,
        "send_profile_like",
        {
          user_id: Number(user_id),
          count: times,
        },
        {
          logSuccess: `点赞：${times}次`,
          logUin: `${data.self_id} => ${user_id}`,
        },
      )
    }

    async deleteFriend(data, user_id) {
      return this.execApi(
        data,
        "delete_friend",
        {
          user_id: Number(user_id),
        },
        {
          logSuccess: `删除好友`,
          logUin: `${data.self_id} => ${user_id}`,
        },
      )
    }

    async sendFriendNudge(data) {
      return this.execApi(
        data,
        "send_friend_nudge",
        {
          user_id: Number(data.user_id),
        },
        {
          logSuccess: `发送好友戳一戳`,
          logUin: `${data.self_id} => ${data.user_id}`,
        },
      )
    }

    async sendGroupNudge(data) {
      return this.execApi(
        data,
        "send_group_nudge",
        {
          group_id: Number(data.group_id),
          user_id: Number(data.user_id),
        },
        {
          logSuccess: `发送群戳一戳`,
          logUin: `${data.self_id} => ${data.group_id}, ${data.user_id}`,
        },
      )
    }

    async sendGroupMessageReaction(data, reaction, is_add = true) {
      return this.execApi(
        data,
        "send_group_message_reaction",
        {
          group_id: Number(data.group_id),
          message_seq: Number(data.message_seq),
          reaction,
          is_add,
        },
        {
          logSuccess: `${is_add ? "添加" : "删除"}消息回应：${reaction}`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async setGroupEssenceMessage(data, is_set = true) {
      return this.execApi(
        data,
        "set_group_essence_message",
        {
          group_id: Number(data.group_id),
          message_seq: Number(data.message_seq),
          is_set,
        },
        {
          logSuccess: `${is_set ? "设置" : "取消"}群精华消息：${data.message_seq}`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async getGroupEssenceMessages(data, page_index = 0, page_size = 50) {
      return this.execApi(
        data,
        "get_group_essence_messages",
        {
          group_id: Number(data.group_id),
          page_index,
          page_size,
        },
        {
          silent: true,
        },
      )
    }

    async sendGroupAnnouncement(data, content, image_uri) {
      return this.execApi(
        data,
        "send_group_announcement",
        {
          group_id: Number(data.group_id),
          content,
          image_uri,
        },
        {
          logSuccess: `发送群公告：${String(content).substring(0, 20)}`,
          logUin: `${data.self_id} => ${data.group_id}`,
        },
      )
    }

    async getGroupAnnouncements(data) {
      return this.execApi(
        data,
        "get_group_announcements",
        {
          group_id: Number(data.group_id),
        },
        {
          silent: true,
        },
      )
    }

    async acceptFriendRequest(data, initiator_uid, is_filtered = false) {
      return this.execApi(
        data,
        "accept_friend_request",
        {
          initiator_uid,
          is_filtered,
        },
        {
          silent: true,
        },
      )
    }

    async rejectFriendRequest(data, initiator_uid, is_filtered = false, reason) {
      return this.execApi(
        data,
        "reject_friend_request",
        {
          initiator_uid,
          is_filtered,
          reason,
        },
        {
          silent: true,
        },
      )
    }

    async acceptGroupRequest(
      data,
      notification_seq,
      notification_type,
      group_id,
      is_filtered = false,
    ) {
      return this.execApi(
        data,
        "accept_group_request",
        {
          notification_seq,
          notification_type,
          group_id: Number(group_id),
          is_filtered,
        },
        {
          silent: true,
        },
      )
    }

    async rejectGroupRequest(
      data,
      notification_seq,
      notification_type,
      group_id,
      is_filtered = false,
      reason,
    ) {
      return this.execApi(
        data,
        "reject_group_request",
        {
          notification_seq,
          notification_type,
          group_id: Number(group_id),
          is_filtered,
          reason,
        },
        {
          silent: true,
        },
      )
    }

    async acceptGroupInvitation(data, group_id, invitation_seq) {
      return this.execApi(
        data,
        "accept_group_invitation",
        {
          group_id: Number(group_id),
          invitation_seq: Number(invitation_seq),
        },
        {
          silent: true,
        },
      )
    }

    async rejectGroupInvitation(data, group_id, invitation_seq) {
      return this.execApi(
        data,
        "reject_group_invitation",
        {
          group_id: Number(group_id),
          invitation_seq: Number(invitation_seq),
        },
        {
          silent: true,
        },
      )
    }

    async getMsg(data) {
      return this.execApi(
        data,
        "get_message",
        {
          message_scene: data.message_scene,
          peer_id: data.peer_id,
          message_seq: data.message_seq,
        },
        {
          silent: true,
        },
      )
    }

    async getHistoryMessages(data) {
      return this.execApi(
        data,
        "get_history_messages",
        {
          message_scene: data.message_scene,
          peer_id: data.peer_id,
          start_message_seq: data.start_message_seq,
          limit: data.limit,
        },
        {
          silent: true,
        },
      )
    }

    async uploadGroupFile(data, file, folder = "/", name) {
      return this.execApi(
        data,
        "upload_group_file",
        {
          group_id: Number(data.group_id),
          file: this.fixUri(file),
          folder,
          name,
        },
        {
          silent: true,
        },
      )
    }

    async deleteGroupFile(data, file_id) {
      return this.execApi(
        data,
        "delete_group_file",
        {
          group_id: Number(data.group_id),
          file_id,
        },
        {
          silent: true,
        },
      )
    }

    async getGroupFilesList(data, folder_id = "/") {
      return this.execApi(
        data,
        "get_group_files_list",
        {
          group_id: Number(data.group_id),
          folder_id,
        },
        {
          silent: true,
        },
      )
    }

    async createGroupFileFolder(data, name) {
      return this.execApi(
        data,
        "create_group_file_folder",
        {
          group_id: Number(data.group_id),
          name,
        },
        {
          silent: true,
        },
      )
    }

    async deleteGroupFileFolder(data, folder_id) {
      return this.execApi(
        data,
        "delete_group_file_folder",
        {
          group_id: Number(data.group_id),
          folder_id,
        },
        {
          silent: true,
        },
      )
    }

    async getProfile(data) {
      return this.execApi(
        data,
        "get_user_profile",
        {
          user_id: Number(data.user_id),
        },
        {
          silent: true,
        },
      )
    }

    async setBio(data, new_bio) {
      return this.execApi(
        data,
        "set_bio",
        {
          new_bio,
        },
        {
          silent: true,
        },
      )
    }

    formatFriend(friend) {
      if (!friend) return friend
      return {
        ...friend,
        user_id: Number(friend.user_id),
        nickname: friend.nickname || "",
        remark: friend.remark || "",
        sex: friend.sex || "unknown",
      }
    }

    formatGroup(group) {
      if (!group) return group
      return {
        ...group,
        group_id: Number(group.group_id),
        group_name: group.group_name || "",
        member_count: group.member_count || 0,
        max_member_count: group.max_member_count || 2000,
      }
    }

    formatMember(member) {
      if (!member) return member
      return {
        ...member,
        group_id: Number(member.group_id),
        user_id: Number(member.user_id),
        nickname: member.nickname || "",
        card: member.card || "",
        sex: member.sex || "unknown",
        age: 0,
        area: "",
        join_time: member.join_time || 0,
        last_sent_time: member.last_sent_time || 0,
        level: String(member.level || 1),
        role: member.role || "member",
        unfriendly: false,
        title: member.title || "",
        title_expire_time: 0,
        card_changeable: true,
      }
    }

    async getFriendMap(data) {
      const res = await this.execApi(data, "get_friend_list", {}, { silent: true })
      if (res.retcode === 0 && res.data?.friends) {
        for (const f of res.data.friends) {
          data.bot.fl.set(String(f.user_id), f)
        }
      }
      return data.bot.fl
    }

    async getGroupMap(data) {
      const res = await this.execApi(data, "get_group_list", {}, { silent: true })
      if (res.retcode === 0 && res.data?.groups) {
        for (const g of res.data.groups) {
          data.bot.gl.set(String(g.group_id), g)
        }
      }
      return data.bot.gl
    }

    async getMemberMap(data) {
      const res = await this.execApi(
        data,
        "get_group_member_list",
        {
          group_id: Number(data.group_id),
        },
        { silent: true },
      )

      if (res.retcode === 0 && res.data?.members) {
        const map = new Map()
        for (const m of res.data.members) {
          map.set(String(m.user_id), m)
        }
        data.bot.gml.set(String(data.group_id), map)
        return map
      }

      return new Map()
    }

    async getFriendInfo(data) {
      const res = await this.execApi(
        data,
        "get_friend_info",
        {
          user_id: Number(data.user_id),
        },
        { silent: true },
      )

      const friend = res.data?.friend || res.data
      return this.formatFriend(friend)
    }

    async getFriendList(data) {
      const res = await this.execApi(data, "get_friend_list", {}, { silent: true })
      if (res.retcode === 0 && res.data?.friends) {
        return res.data.friends.map(f => this.formatFriend(f))
      }
      return []
    }

    async getGroupInfo(data) {
      const res = await this.execApi(
        data,
        "get_group_info",
        {
          group_id: Number(data.group_id),
        },
        { silent: true },
      )

      const group = res.data?.group || res.data
      return this.formatGroup(group)
    }

    async getGroupList(data) {
      const res = await this.execApi(data, "get_group_list", {}, { silent: true })
      if (res.retcode === 0 && res.data?.groups) {
        return res.data.groups.map(g => this.formatGroup(g))
      }
      return []
    }

    async getMemberInfo(data) {
      const res = await this.execApi(
        data,
        "get_group_member_info",
        {
          group_id: Number(data.group_id),
          user_id: Number(data.user_id),
        },
        { silent: true },
      )

      const member = res.data?.member || res.data
      return this.formatMember(member)
    }

    async getMemberList(data) {
      const res = await this.execApi(
        data,
        "get_group_member_list",
        {
          group_id: Number(data.group_id),
        },
        { silent: true },
      )

      if (res.retcode === 0 && res.data?.members) {
        return res.data.members.map(m => this.formatMember(m))
      }
      return []
    }
  })(),
)
