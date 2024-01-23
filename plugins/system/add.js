import cfg from "../../lib/config/config.js"
import plugin from "../../lib/plugins/plugin.js"
import common from "../../lib/common/common.js"
import fs from "node:fs"
import path from "node:path"
import lodash from "lodash"
import fetch from "node-fetch"

let messageMap = {}

export class add extends plugin {
  constructor() {
    super({
      name: "添加消息",
      dsc: "添加消息",
      event: "message",
      priority: 50000,
      rule: [
        {
          reg: "^#(全局)?添加",
          fnc: "add"
        },
        {
          reg: "^#(全局)?删除",
          fnc: "del"
        },
        {
          reg: "",
          fnc: "getMessage",
          log: false
        },
        {
          reg: "^#(全局)?(消息|词条)",
          fnc: "list"
        }
      ]
    })

    this.path = "data/messageJson/"
  }

  async init() {
    Bot.mkdir(this.path)
  }

  /** 群号key */
  get grpKey() {
    return `Yz:group_id:${this.e.user_id}`
  }

  /** #添加 */
  async add() {
    this.isGlobal = Boolean(this.e.msg.match(/^#全局/))
    await this.getGroupId()

    if (!this.group_id) {
      await this.reply("请先在群内触发消息，确定添加的群")
      return
    }

    this.initMessageMap()

    if (!this.checkAuth()) return false
    /** 获取关键词 */
    this.getKeyWord()
    if (!this.e.keyWord) {
      await this.reply("添加错误：没有关键词")
      return
    }

    this.e.message = []
    this.setContext("addContext")

    return this.reply("请发送添加内容，完成后发送#结束添加", true, { at: true })
  }

  /** 获取群号 */
  async getGroupId() {
    /** 添加全局消息，存入到机器人文件中 */
    if (this.isGlobal) {
      this.group_id = "global"
      return this.group_id
    }

    if (this.e.isGroup) {
      this.group_id = this.e.group_id
      redis.setEx(this.grpKey, 3600 * 24 * 30, String(this.group_id))
      return this.group_id
    }

    // redis获取
    let groupId = await redis.get(this.grpKey)
    if (groupId) {
      this.group_id = groupId
      return this.group_id
    }

    return false
  }

  checkAuth() {
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
    if (groupCfg.addLimit == 1) {
      if (!this.e.member.is_admin) {
        this.reply("暂无权限，只有管理员才能操作")
        return false
      }
    }

    if (groupCfg.addPrivate != 1 && !this.e.isGroup) {
      this.reply("禁止私聊添加")
      return false
    }

    return true
  }

  /** 获取添加关键词 */
  getKeyWord() {
    this.e.isGlobal = Boolean(this.e.msg.match(/^#全局/))
    this.keyWord = this.e.raw_message.replace(/#(全局)?(添加|删除)/, "").trim()
    this.e.keyWord = this.trimAlias(this.keyWord)
  }

  /** 过滤别名 */
  trimAlias(msg) {
    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    let alias = groupCfg.botAlias
    if (!Array.isArray(alias))
      alias = [alias]

    for (const name of alias)
      if (msg.startsWith(name))
        msg = lodash.trimStart(msg, name).trim()

    return msg
  }

  /** 添加内容 */
  async addContext() {
    const context = this.getContext()?.addContext
    this.isGlobal = context.isGlobal
    await this.getGroupId()
    /** 关键词 */
    this.keyWord = context.keyWord

    if (!this.e.msg?.includes("#结束添加")) {
      /** 添加内容 */
      for (const i of this.e.message) {
        if (i.url) i.file = await this.saveFile(i)
        if (i.type == "at" && i.qq == this.e.self_id) continue
        context.message.push(i)
      }
      return
    }

    this.finish("addContext")
    if (!context.message?.length) {
      this.reply("添加错误：没有添加内容")
      return
    }

    if (!messageMap[this.group_id])
      messageMap[this.group_id] = new Map()

    /** 支持单个关键词添加多个 */
    let message = messageMap[this.group_id].get(this.keyWord)
    if (Array.isArray(message))
      message.push(context.message)
    else
      message = [context.message]
    messageMap[this.group_id].set(this.keyWord, message)

    if (message.length > 1)
      this.keyWord += String(message.length)

    this.saveJson()
    return this.reply(`添加成功：${this.keyWord}`)
  }

  saveJson() {
    let obj = {}
    for (let [k, v] of messageMap[this.group_id])
      obj[k] = v

    fs.writeFileSync(`${this.path}${this.group_id}.json`, JSON.stringify(obj, "", "\t"))
  }

  async saveFile(data) {
    const file = await Bot.fileType(data)
    if (Buffer.isBuffer(file.buffer)) {
      if (!file.name) file.name = `${Date.now()}-${path.basename(data.file || data.url)}`
      file.name = `${this.group_id}/${data.type}/${file.name}`
      file.path = `${this.path}${file.name}`
      Bot.mkdir(path.dirname(file.path))
      fs.writeFileSync(file.path, file.buffer)
      return file.name
    }
    return data.url
  }

  async getMessage() {
    if (!this.e.raw_message) return false
    this.isGlobal = false

    await this.getGroupId()
    if (!this.group_id) return false

    this.initMessageMap()
    this.initGlobalMessageMap()

    this.keyWord = this.trimAlias(this.e.raw_message.trim())
    let keyWord = this.keyWord

    let num = 0
    if (isNaN(keyWord)) {
      num = keyWord.charAt(keyWord.length-1)

      if (!isNaN(num) && !messageMap[this.group_id].has(keyWord) && !messageMap.global.has(keyWord)) {
        keyWord = lodash.trimEnd(keyWord, num).trim()
        num--
      }
    }

    let msg = [
      ...messageMap[this.group_id].get(keyWord) || [],
      ...messageMap.global.get(keyWord) || [],
    ]
    if (lodash.isEmpty(msg)) return false

    if (!msg[num])
      num = lodash.random(0, msg.length-1)

    msg = [...msg[num]]
    for (const i in msg)
      if (msg[i].file && fs.existsSync(`${this.path}${msg[i].file}`))
        msg[i] = { ...msg[i], file: fs.readFileSync(`${this.path}${msg[i].file}`) }

    logger.mark(`[发送消息]${this.e.logText} ${this.keyWord}`)
    const groupCfg = cfg.getGroup(this.e.self_id, this.group_id)
    return this.reply(msg, Boolean(groupCfg.addReply), {
      at: Boolean(groupCfg.addAt),
      recallMsg: groupCfg.addRecall,
    })
  }

  /** 初始化已添加内容 */
  initMessageMap() {
    if (messageMap[this.group_id]) return
    messageMap[this.group_id] = new Map()

    const path = `${this.path}${this.group_id}.json`
    if (!fs.existsSync(path)) return

    try {
      const message = JSON.parse(fs.readFileSync(path, "utf8"))
      for (const i in message)
        messageMap[this.group_id].set(i, message[i])
    } catch (err) {
      logger.error(`JSON 格式错误：${path} ${err}`)
    }
  }

  /** 初始化全局已添加内容 */
  initGlobalMessageMap() {
    if (messageMap.global) return
    messageMap.global = new Map()

    const globalPath = `${this.path}global.json`
    if (!fs.existsSync(globalPath)) return

    try {
      const message = JSON.parse(fs.readFileSync(globalPath, "utf8"))
      for (const i in message)
        messageMap.global.set(i, message[i])
    } catch (err) {
      logger.error(`JSON 格式错误：${globalPath} ${err}`)
    }
  }

  async del() {
    this.isGlobal = this.e.msg.includes("全局")
    await this.getGroupId()
    if (!(this.group_id && this.checkAuth())) return false

    this.initMessageMap()

    this.getKeyWord()
    if (!this.keyWord) {
      await this.reply("删除错误：没有关键词")
      return false
    }

    this.keyWord = this.trimAlias(this.keyWord)
    let keyWord = this.keyWord

    let num = false
    let index = 0
    if (isNaN(keyWord)) {
      num = keyWord.charAt(keyWord.length-1)

      if (!isNaN(num) && !messageMap[this.group_id].has(keyWord)) {
        keyWord = lodash.trimEnd(keyWord, num).trim()
        index = num-1
      } else {
        num = false
      }
    }

    let arr = messageMap[this.group_id].get(keyWord)
    if (!arr) {
      // await this.reply(`暂无此消息：${keyWord}`)
      return false
    }

    let tmp = []
    if (num) {
      if (!arr[index]) {
        // await this.reply(`暂无此消息：${keyWord}${num}`)
        return false
      }

      tmp = arr[index]
      arr.splice(index, 1)

      if (arr.length <= 0) {
        messageMap[this.group_id].delete(keyWord)
      } else {
        messageMap[this.group_id].set(keyWord, arr)
      }
    } else {
      if (this.e.msg.includes("删除全部")) {
        tmp = arr
        arr = []
      } else {
        tmp = arr.pop()
      }

      if (arr.length <= 0) {
        messageMap[this.group_id].delete(keyWord)
      } else {
        messageMap[this.group_id].set(keyWord, arr)
      }
    }

    this.saveJson()
    return this.reply(`删除成功：${this.keyWord}`)
  }

  async list() {
    this.isGlobal = Boolean(this.e.msg.match(/^#全局/))

    let page = 1
    let pageSize = 100
    let type = "list"

    await this.getGroupId()
    if (!this.group_id) return false

    this.initMessageMap()

    const search = this.e.msg.replace(/^#(全局)?(消息|词条)/, "").trim()
    if (search.match(/^列表/))
      page = search.replace(/^列表/, "") || 1
    else
      type = "search"

    let list = messageMap[this.group_id]

    if (lodash.isEmpty(list)) {
      await this.reply("暂无消息")
      return
    }

    let arr = []
    if (type == "list")
      for (let [k, v] of messageMap[this.group_id])
        arr.push({ key: k, val: v, num: arr.length+1 })
    else
      for (let [k, v] of messageMap[this.group_id])
        if (k.includes(search))
          arr.push({ key: k, val: v, num: arr.length+1 })

    let count = arr.length
    arr = arr.reverse()

    if (type == "list")
      arr = this.pagination(page, pageSize, arr)
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
    msg = [msg.join("\n")]

    if (type == "list" && count > 100)
      msg.push(`更多内容请翻页查看\n如：#消息列表${Number(page)+1}`)

    let title = `消息列表：第${page}页，共${count}条`
    if (type == "search")
      title = `消息${search}：共${count}条`

    return this.reply(await common.makeForwardMsg(this.e, msg, title))
  }

  /** 分页 */
  pagination(pageNo, pageSize, array) {
    let offset = (pageNo-1) * pageSize
    return offset+pageSize >= array.length ? array.slice(offset, array.length) : array.slice(offset, offset+pageSize)
  }
}