import cfg from "../../lib/config/config.js"
import fs from "node:fs/promises"
import path from "node:path"
import lodash from "lodash"

export const messageMap = {}

export class add extends plugin {
  constructor() {
    super({
      name: "添加消息",
      dsc: "添加消息",
      event: "message",
      priority: Infinity,
      rule: [
        {
          reg: "^#(全局)?添加",
          fnc: "add",
        },
        {
          reg: "^#(全局)?删除",
          fnc: "del",
        },
        {
          reg: "",
          fnc: "getMessage",
          log: false,
        },
        {
          reg: "^#(全局)?(消息|词条)",
          fnc: "list",
        },
      ],
    })

    this.path = "data/messageJson/"
  }

  async init() {
    await Bot.mkdir(this.path)
  }

  /** 群号key */
  get grpKey() {
    return `Yz:group_id:${this.e.user_id}`
  }

  /** #添加 */
  async add() {
    this.isGlobal = Boolean(this.e.msg.match(/^#全局/))
    await this.getGroupId()

    if (!this.group_id) return this.reply("请先在群内触发消息，确定添加的群")

    await this.initMessageMap()

    if (!this.checkAuth(await this.getAuthMember())) return false
    /** 获取关键词 */
    this.getKeyWord()
    if (!this.keyWord) return this.reply("添加错误：没有关键词")

    this.e.keyWord = this.keyWord
    this.e.addGroupId = this.group_id
    this.e.message = []
    this.setContext("addContext")

    return this.reply("请发送添加内容，完成后发送#结束添加", true, { at: true })
  }

  /** 获取群号 */
  async getGroupId() {
    if (this.isGlobal) {
      this.group_id = "global"
      return this.group_id
    }

    if (this.e.isGroup) {
      this.group_id = this.e.group_id
      redis.setEx(this.grpKey, 2592000, String(this.group_id))
      return this.group_id
    }

    return (this.group_id = await redis.get(this.grpKey))
  }

  /** 私聊管理员操作只信任目标群查询返回的权限，不修改原消息成员对象 */
  async getAuthMember() {
    if (this.e.isMaster || this.isGlobal || this.e.isGroup) return this.e.member
    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    if (groupCfg.addLimit != 1 || groupCfg.addPrivate != 1) return this.e.member
    try {
      let groupId = this.group_id
      const groups = this.e.bot.gl
      if (groups && !groups.has(groupId))
        for (const id of groups.keys())
          if (String(id) === String(groupId)) {
            groupId = id
            break
          }
      const member = this.e.bot.pickGroup(groupId).pickMember(this.e.user_id)
      if (typeof member.getInfo !== "function") return null
      const info = await member.getInfo(true)
      if (!info || typeof info !== "object") return null
      if (!("role" in info || "is_admin" in info || "is_owner" in info)) return null
      return {
        is_admin:
          info.role === "admin" ||
          info.role === "owner" ||
          info.is_admin === true ||
          info.is_owner === true,
      }
    } catch (err) {
      logger.warn(`获取词条目标群成员权限失败：${this.group_id}`, err)
      return null
    }
  }

  checkAuth(member = this.e.member) {
    if (this.e.isMaster) return true
    if (this.isGlobal) {
      this.reply("暂无权限，只有主人才能操作")
      return false
    }

    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    if (groupCfg.addLimit == 2) {
      this.reply("暂无权限，只有主人才能操作")
      return false
    }
    if (groupCfg.addPrivate != 1 && !this.e.isGroup) {
      this.reply("禁止私聊添加")
      return false
    }

    if (groupCfg.addLimit == 1) {
      if (member === null) {
        this.reply("无法确认管理员权限，请在群内操作")
        return false
      }
      if (!member?.is_admin) {
        this.reply("暂无权限，只有管理员才能操作")
        return false
      }
    }

    return true
  }

  /** 获取添加关键词 */
  getKeyWord() {
    this.e.isGlobal = Boolean(this.e.msg.match(/^#全局/))
    const prefix = cfg.bot["/→#"]
      ? /(?:#|[＃井/]\s*)(全局)?(添加|删除)/
      : /(?:#|[＃井]\s*)(全局)?(添加|删除)/
    const pattern = new RegExp(`\\[[^\\]]*\\]|<[^>]*>|(${prefix.source})`, "g")
    let removed = false
    const raw = this.e.raw_message.replace(pattern, (text, command) => {
      if (!removed && command) {
        removed = true
        return ""
      }
      return text
    })
    this.keyWord = this.trimAlias(raw.trim())
  }

  /** 过滤别名 */
  trimAlias(msg) {
    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    let alias = groupCfg.botAlias
    if (!Array.isArray(alias)) alias = [alias]

    for (const name of alias) if (msg.startsWith(name)) msg = lodash.trimStart(msg, name).trim()

    return msg
  }

  /** 添加内容 */
  async addContext() {
    const context = this.getContext("addContext")
    this.isGlobal = context.isGlobal
    this.group_id = context.addGroupId
    if (!this.group_id) {
      this.finish("addContext")
      return this.reply("添加已失效，请重新添加")
    }
    if (!this.isGlobal && this.e.isGroup && String(this.e.group_id) !== String(this.group_id))
      return "continue"
    /** 关键词 */
    this.keyWord = context.keyWord

    if (!this.e.msg?.includes("#结束添加")) {
      /** 添加内容 */
      for (const i of this.e.message) {
        if (i.url) {
          i.file = await this.saveFile(i)
          delete i.url
          delete i.fid
        }
        if (i.type == "at" && i.qq == this.e.self_id) continue
        context.message.push(i)
      }
      return
    }

    this.finish("addContext")
    if (!context.message?.length) return this.reply("添加错误：没有添加内容")

    if (!messageMap[this.group_id]) messageMap[this.group_id] = new Map()

    /** 支持单个关键词添加多个 */
    let message = messageMap[this.group_id].get(this.keyWord)
    if (Array.isArray(message)) message.push(context.message)
    else message = [context.message]
    messageMap[this.group_id].set(this.keyWord, message)
    if (message.length > 1) this.keyWord += `(${message.length})`

    await this.saveJson()
    return this.reply(`添加成功：${this.keyWord}`)
  }

  async saveJson() {
    const obj = {}
    for (const [k, v] of messageMap[this.group_id]) obj[k] = v

    await fs.writeFile(`${this.path}${this.group_id}.json`, JSON.stringify(obj, "", "\t"))
  }

  async saveFile(data) {
    const file = await Bot.fileType({ ...data, file: data.url })
    if (Buffer.isBuffer(file.buffer)) {
      file.name = `${this.group_id}/${data.type}/${file.name}`
      file.path = `${this.path}${file.name}`
      await Bot.mkdir(path.dirname(file.path))
      await fs.writeFile(file.path, file.buffer)
      return file.name
    }
    return data.url
  }

  getKeyWordMsg(keyWord) {
    return [
      ...(messageMap[this.group_id].get(keyWord) || []),
      ...(messageMap.global.get(keyWord) || []),
    ]
  }

  async getMessage() {
    if (!this.e.raw_message) return false
    this.isGlobal = false

    await this.getGroupId()
    if (!this.group_id) return false

    await this.initMessageMap()
    await this.initGlobalMessageMap()

    this.keyWord = this.trimAlias(this.e.raw_message.trim())

    let msg = this.getKeyWordMsg(this.keyWord)
    if (!msg.length) {
      const index = this.keyWord.match(/\d+$/)?.[0]
      if (index)
        for (let i = 0; i < index.length; i++) {
          const keyWord = this.keyWord.slice(0, this.keyWord.length - index.length + i)
          msg = this.getKeyWordMsg(keyWord)
          if (msg.length) {
            const n = index.slice(-i)
            msg = msg[n - 1]
            if (msg) {
              this.keyWord = `${keyWord}(${n})`
              break
            }
          }
        }
    } else {
      msg = msg[lodash.random(0, msg.length - 1)]
    }
    if (lodash.isEmpty(msg)) return false

    msg = [...msg]
    for (const i in msg)
      if (msg[i].file && (await Bot.fsStat(`${this.path}${msg[i].file}`)))
        msg[i] = { ...msg[i], file: `${this.path}${msg[i].file}` }

    logger.mark(`[发送消息]${this.e.logText}[${this.keyWord}]`)
    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    return this.reply(msg, Boolean(groupCfg.addReply), {
      at: Boolean(groupCfg.addAt),
      recallMsg: groupCfg.addRecall,
    })
  }

  /** 初始化已添加内容 */
  async initMessageMap() {
    if (messageMap[this.group_id]) return
    messageMap[this.group_id] = new Map()

    const path = `${this.path}${this.group_id}.json`
    if (!(await Bot.fsStat(path))) return

    try {
      const message = JSON.parse(await fs.readFile(path, "utf8"))
      for (const i in message) messageMap[this.group_id].set(i, message[i])
    } catch (err) {
      logger.error(`JSON 格式错误：${path} ${err}`)
    }
  }

  /** 初始化全局已添加内容 */
  async initGlobalMessageMap() {
    if (messageMap.global) return
    messageMap.global = new Map()

    const globalPath = `${this.path}global.json`
    if (!(await Bot.fsStat(globalPath))) return

    try {
      const message = JSON.parse(await fs.readFile(globalPath, "utf8"))
      for (const i in message) messageMap.global.set(i, message[i])
    } catch (err) {
      logger.error(`JSON 格式错误：${globalPath} ${err}`)
    }
  }

  delFile(msg) {
    return Promise.allSettled(msg.map(i => i.file && fs.rm(`${this.path}${i.file}`)))
  }

  async del() {
    this.isGlobal = this.e.msg.includes("全局")
    await this.getGroupId()
    if (!this.group_id || !this.checkAuth(await this.getAuthMember())) return false

    await this.initMessageMap()

    this.getKeyWord()
    if (!this.keyWord) return this.reply("删除错误：没有关键词")

    if (messageMap[this.group_id].has(this.keyWord)) {
      await Promise.allSettled(
        messageMap[this.group_id].get(this.keyWord).map(this.delFile.bind(this)),
      )
      messageMap[this.group_id].delete(this.keyWord)
      await this.saveJson()
      return this.reply(`删除成功：${this.keyWord}`)
    } else {
      const index = this.keyWord.match(/\d+$/)?.[0]
      if (index)
        for (let i = 0; i < index.length; i++) {
          const keyWord = this.keyWord.slice(0, this.keyWord.length - index.length + i)
          const msg = messageMap[this.group_id].get(keyWord)
          if (msg) {
            const n = index.slice(-i) - 1
            if (msg[n]) {
              await this.delFile(msg[n])
              msg.splice(n, 1)
              if (!msg.length) messageMap[this.group_id].delete(keyWord)
              await this.saveJson()
              return this.reply(`删除成功：${keyWord}(${n + 1})`)
            }
          }
        }
    }
    return this.reply("删除错误：没有添加此关键词")
  }

  async list() {
    this.isGlobal = Boolean(this.e.msg.match(/^#全局/))

    let page = 1
    let pageSize = 100
    let type = "list"

    await this.getGroupId()
    if (!this.group_id) return false

    await this.initMessageMap()

    const search = this.e.msg.replace(/^#(全局)?(消息|词条)/, "").trim()
    if (search.match(/^列表/)) page = search.replace(/^列表/, "") || 1
    else type = "search"

    let list = messageMap[this.group_id]

    if (lodash.isEmpty(list)) return this.reply("暂无消息")

    let arr = []
    if (type == "list")
      for (let [k, v] of messageMap[this.group_id])
        arr.push({ key: k, val: v, num: arr.length + 1 })
    else
      for (let [k, v] of messageMap[this.group_id])
        if (k.includes(search)) arr.push({ key: k, val: v, num: arr.length + 1 })

    let count = arr.length
    arr = arr.reverse()

    if (type == "list") arr = this.pagination(page, pageSize, arr)
    if (lodash.isEmpty(arr)) return false

    let msg = []
    let num = 0
    for (const i of arr) {
      if (num >= page * pageSize) break

      let keyWord = i.key
      if (!keyWord) continue

      msg.push(`${i.num}. ${keyWord}(${i.val.length})`)
      num++
    }

    let title = `消息列表：第${page}页，共${count}条`
    if (type == "search") title = `消息${search}：共${count}条`

    msg = [title, msg.join("\n")]

    if (type == "list" && count > 100)
      msg.push(`更多内容请翻页查看\n如：#消息列表${Number(page) + 1}`)

    return this.reply(await Bot.makeForwardArray(msg))
  }

  /** 分页 */
  pagination(pageNo, pageSize, array) {
    let offset = (pageNo - 1) * pageSize
    return offset + pageSize >= array.length
      ? array.slice(offset, array.length)
      : array.slice(offset, offset + pageSize)
  }
}
