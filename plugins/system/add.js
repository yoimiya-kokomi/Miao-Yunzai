
import cfg from '../../lib/config/config.js'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'node:fs'
import lodash from 'lodash'
import { segment } from 'icqq'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import moment from 'moment'

let textArr = {}

export class add extends plugin {
  constructor () {
    super({
      name: '添加表情',
      dsc: '添加表情，文字等',
      event: 'message',
      priority: 50000,
      rule: [
        {
          reg: '^#(全局)?添加(.*)',
          fnc: 'add'
        },
        {
          reg: '^#(全局)?删除(.*)',
          fnc: 'del'
        },
        {
          reg: '(.*)',
          fnc: 'getText',
          log: false
        },
        {
          reg: '#(全局)?(表情|词条)(.*)',
          fnc: 'list'
        }
      ]
    })

    this.path = './data/textJson/'
    this.facePath = './data/face/'
    /** 全局表情标记 */
    this.isGlobal = false
  }

  async init () {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path)
    }
    if (!fs.existsSync(this.facePath)) {
      fs.mkdirSync(this.facePath)
    }
  }

  async accept () {
    /** 处理消息 */
    if (this.e.atBot && this.e.msg && this.e?.msg.includes('添加') && !this.e?.msg.includes('#')) {
      this.e.msg = '#' + this.e.msg
    }
  }

  /** 群号key */
  get grpKey () {
    return `Yz:group_id:${this.e.user_id}`
  }

  /** #添加 */
  async add () {
    this.isGlobal = this.e?.msg.includes("全局");
    await this.getGroupId()

    if (!this.group_id) {
      this.e.reply('请先在群内触发表情，确定添加的群')
      return
    }

    this.initTextArr()

    if (!this.checkAuth()) return
    if (!this.checkKeyWord()) return
    if (await this.singleAdd()) return
    /** 获取关键词 */
    this.getKeyWord()

    if (!this.keyWord) {
      this.e.reply('添加错误：没有关键词')
      return
    }

    this.setContext('addContext')

    await this.e.reply('请发送添加内容', false, { at: true })
  }

  /** 获取群号 */
  async getGroupId () {
    
    /** 添加全局表情，存入到机器人qq文件中 */
    if (this.isGlobal) {
      this.group_id = this.e.bot.uin;
      return this.e.bot.uin;
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

  checkAuth () {
    if (this.e.isMaster) return true

    let groupCfg = cfg.getGroup(this.group_id)
    if (groupCfg.imgAddLimit == 2) {
      this.e.reply('暂无权限，只有主人才能操作')
      return false
    }
    if (groupCfg.imgAddLimit == 1) {
      if (!this.e.bot.gml.has(this.group_id)) {
        return false
      }
      if (!this.e.bot.gml.get(this.group_id).get(this.e.user_id)) {
        return false
      }
      if (!this.e.member.is_admin) {
        this.e.reply('暂无权限，只有管理员才能操作')
        return false
      }
    }

    if (!this.e.isGroup && groupCfg.addPrivate != 1) {
      this.e.reply('禁止私聊添加')
      return false
    }

    return true
  }

  checkKeyWord () {
    if (this.e.img && this.e.img.length > 1) {
      this.e.reply('添加错误：只能发送一个表情当关键词')
      return false
    }

    if (this.e.at) {
      let at = lodash.filter(this.e.message, (o) => { return o.type == 'at' && o.qq != this.e.bot.uin })
      if (at.length > 1) {
        this.e.reply('添加错误：只能@一个人当关键词')
        return false
      }
    }

    if (this.e.img && this.e.at) {
      this.e.reply('添加错误：没有关键词')
      return false
    }

    return true
  }

  /** 单独添加 */
  async singleAdd () {
    if (this.e.message.length != 2) return false
    let msg = lodash.keyBy(this.e.message, 'type')
    if (!this.e.msg || !msg.image) return false

    // #全局添加文字+表情包，无法正确添加到全局路径
    this.e.isGlobal = this.isGlobal;
    let keyWord = this.e.msg.replace(/#|＃|图片|表情|添加|全局/g, '').trim()
    if (!keyWord) return false

    this.keyWord = this.trimAlias(keyWord)
    this.e.keyWord = this.keyWord

    if (this.e.msg.includes('添加图片')) {
      this.e.addImg = true
    }
    this.e.message = [msg.image]
    await this.addContext()

    return true
  }

  /** 获取添加关键词 */
  getKeyWord () {
    this.e.isGlobal = this.e.msg.includes("全局");

    this.keyWord = this.e.toString()
      .trim()
      /** 过滤#添加 */
      .replace(/#|＃|图片|表情|添加|删除|全局/g, '')
      /** 过滤@ */
      .replace(new RegExp('{at:' + this.e.bot.uin + '}', 'g'), '')
      .trim()

    this.keyWord = this.trimAlias(this.keyWord)
    this.e.keyWord = this.keyWord

    if (this.e.msg.includes('添加图片')) {
      this.e.addImg = true
    }
  }

  /** 过滤别名 */
  trimAlias (msg) {
    let groupCfg = cfg.getGroup(this.group_id)
    let alias = groupCfg.botAlias
    if (!Array.isArray(alias)) {
      alias = [alias]
    }
    for (let name of alias) {
      if (msg.startsWith(name)) {
        msg = lodash.trimStart(msg, name).trim()
      }
    }

    return msg
  }

  /** 添加内容 */
  async addContext () {
    this.isGlobal = this.e.isGlobal || this.getContext()?.addContext?.isGlobal;
    await this.getGroupId()
    /** 关键词 */
    let keyWord = this.keyWord || this.getContext()?.addContext?.keyWord
    let addImg = this.e.addImg || this.getContext()?.addContext?.addImg

    /** 添加内容 */
    let message = this.e.message

    let retMsg = this.getRetMsg()
    this.finish('addContext')

    for (let i in message) {
      if (message[i].type == 'at') {
        if (message[i].qq == this.e.bot.uin) {
          this.e.reply('添加内容不能@机器人！')
          return
        }
      }
      if (message[i].type == 'file') {
        this.e.reply('添加错误：禁止添加文件')
        return
      }
    }

    if (message.length == 1 && message[0].type == 'image') {
      let local = await this.saveImg(message[0].url, keyWord)
      if (!local) return
      message[0].local = local
      message[0].asface = true
      if (addImg) message[0].asface = false
    }

    if (!textArr[this.group_id]) textArr[this.group_id] = new Map()

    /** 支持单个关键词添加多个 */
    let text = textArr[this.group_id].get(keyWord)
    if (text) {
      text.push(message)
      textArr[this.group_id].set(keyWord, text)
    } else {
      text = [message]
      textArr[this.group_id].set(keyWord, text)
    }

    if (text.length > 1 && retMsg[0].type != 'image') {
      retMsg.push(String(text.length))
    }

    retMsg.unshift('添加成功：')

    this.saveJson()
    this.e.reply(retMsg)
  }

  /** 添加成功回复消息 */
  getRetMsg () {
    let retMsg = this.getContext()
    let msg = ''
    if (retMsg?.addContext?.message) {
      msg = retMsg.addContext.message

      for (let i in msg) {
        if (msg[i].type == 'text' && msg[i].text.includes('添加')) {
          msg[i].text = this.trimAlias(msg[i].text)
          msg[i].text = msg[i].text.trim().replace(/#|＃|图片|表情|添加|全局/g, '')
          if (!msg[i].text) delete msg[i]
          continue
        }
        if (msg[i].type == 'at') {
          if (msg[i].qq == this.e.bot.uin) {
            delete msg[i]
            continue
          } else {
            msg[i].text = ''
          }
        }
      }
    }
    if (!msg && this.keyWord) {
      msg = [this.keyWord]
    }
    return lodash.compact(msg)
  }

  saveJson () {
    let obj = {}
    for (let [k, v] of textArr[this.group_id]) {
      obj[k] = v
    }

    fs.writeFileSync(`${this.path}${this.group_id}.json`, JSON.stringify(obj, '', '\t'))
  }
  
  saveGlobalJson() {
    let obj = {};
    for (let [k, v] of textArr[this.e.bot.uin]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.path}${this.e.bot.uin}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }

  async saveImg (url, keyWord) {
    let groupCfg = cfg.getGroup(this.group_id)
    let savePath = `${this.facePath}${this.group_id}/`

    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath)
    }

    const response = await fetch(url)

    keyWord = keyWord.replace(/\.|\\|\/|:|\*|\?|<|>|\|"/g, '_')

    if (!response.ok) {
      this.e.reply('添加图片下载失败。。')
      return false
    }

    let imgSize = (response.headers.get('size') / 1024 / 1024).toFixed(2)
    if (imgSize > 1024 * 1024 * groupCfg.imgMaxSize) {
      this.e.reply(`添加失败：表情太大了，${imgSize}m`)
      return false
    }

    let type = response.headers.get('content-type').split('/')[1]
    if (type == 'jpeg') type = 'jpg'

    if (fs.existsSync(`${savePath}${keyWord}.${type}`)) {
      keyWord = `${keyWord}_${moment().format('X')}`
    }

    savePath = `${savePath}${keyWord}.${type}`

    const streamPipeline = promisify(pipeline)
    await streamPipeline(response.body, fs.createWriteStream(savePath))

    return savePath
  }

  async getText () {
    if (!this.e.message) return false
    
    this.isGlobal = false

    await this.getGroupId()

    if (!this.group_id) return false

    this.initTextArr()
    
    this.initGlobalTextArr()

    let keyWord = this.e.toString()
      .replace(/#|＃/g, '')
      .replace(`{at:${this.e.bot.uin}}`, '')
      .trim()

    keyWord = this.trimAlias(keyWord)

    let num = 0
    if (isNaN(keyWord)) {
      num = keyWord.charAt(keyWord.length - 1)

      if (!isNaN(num) && !textArr[this.group_id].has(keyWord) && !textArr[this.e.bot.uin].has(keyWord)) {
        keyWord = lodash.trimEnd(keyWord, num).trim()
        num--
      }
    }

    let msg = textArr[this.group_id].get(keyWord) || []
    let globalMsg = textArr[this.e.bot.uin].get(keyWord) || []
    if (lodash.isEmpty(msg) && lodash.isEmpty(globalMsg)) return false

    msg = [...msg, ...globalMsg]
    
    if (num >= 0 && num < msg.length) {
      msg = msg[num]
    } else {
      /** 随机获取一个 */
      num = lodash.random(0, msg.length - 1)
      msg = msg[num]
    }

    if (msg[0] && msg[0].local) {
      if (fs.existsSync(msg[0].local)) {
        let tmp = segment.image(msg[0].local)
        tmp.asface = msg[0].asface
        msg = tmp
      } else {
        // this.e.reply(`表情已删除：${keyWord}`)
        return
      }
    }

    if (Array.isArray(msg)) {
      msg.forEach(m => {
        /** 去除回复@@ */
        if (m?.type == 'at') { delete m.text }
      })
    }

    logger.mark(`[发送表情]${this.e.logText} ${keyWord}`)
    let ret = await this.e.reply(msg)
    if (!ret) {
      this.expiredMsg(keyWord, num)
    }

    return true
  }

  expiredMsg (keyWord, num) {
    logger.mark(`[发送表情]${this.e.logText} ${keyWord} 表情已过期失效`)

    let arr = textArr[this.group_id].get(keyWord)
    arr.splice(num, 1)

    if (arr.length <= 0) {
      textArr[this.group_id].delete(keyWord)
    } else {
      textArr[this.group_id].set(keyWord, arr)
    }

    this.saveJson()
  }

  /** 初始化已添加内容 */
  initTextArr () {
    if (textArr[this.group_id]) return

    textArr[this.group_id] = new Map()

    let path = `${this.path}${this.group_id}.json`
    if (!fs.existsSync(path)) {
      return
    }

    try {
      let text = JSON.parse(fs.readFileSync(path, 'utf8'))
      for (let i in text) {
        if (text[i][0] && !Array.isArray(text[i][0])) {
          text[i] = [text[i]]
        }

        textArr[this.group_id].set(String(i), text[i])
      }
    } catch (error) {
      logger.error(`json格式错误：${path}`)
      delete textArr[this.group_id]
      return false
    }

    /** 加载表情 */
    let facePath = `${this.facePath}${this.group_id}`

    if (fs.existsSync(facePath)) {
      const files = fs.readdirSync(`${this.facePath}${this.group_id}`).filter(file => /\.(jpeg|jpg|png|gif)$/g.test(file))
      for (let val of files) {
        let tmp = val.split('.')
        tmp[0] = tmp[0].replace(/_[0-9]{10}$/, '')
        if (/at|image/g.test(val)) continue

        if (textArr[this.group_id].has(tmp[0])) continue

        textArr[this.group_id].set(tmp[0], [[{
          local: `${facePath}/${val}`,
          asface: true
        }]])
      }

      this.saveJson()
    } else {
      fs.mkdirSync(facePath)
    }
  }
  
  /** 初始化全局已添加内容 */
  initGlobalTextArr() {
    if (textArr[this.e.bot.uin]) return;

    textArr[this.e.bot.uin] = new Map();

    let globalPath = `${this.path}${this.e.bot.uin}.json`;
    if (!fs.existsSync(globalPath)) {
      return;
    }

    try {
      let text = JSON.parse(fs.readFileSync(globalPath, "utf8"));

      for (let i in text) {
        if (text[i][0] && !Array.isArray(text[i][0])) {
          text[i] = [text[i]];
        }
        textArr[this.e.bot.uin].set(String(i), text[i]);
      }
    } catch (error) {
      logger.error(`json格式错误：${globalPath}`);
      delete textArr[this.e.bot.uin];
      return false;
    }

    /** 加载表情 */
    let globalFacePath = `${this.facePath}${this.e.bot.uin}`;

    if (fs.existsSync(globalFacePath)) {
      const files = fs
        .readdirSync(`${this.facePath}${this.e.bot.uin}`)
        .filter((file) => /\.(jpeg|jpg|png|gif)$/g.test(file));

      for (let val of files) {
        let tmp = val.split(".");
        tmp[0] = tmp[0].replace(/_[0-9]{10}$/, "");
        if (/at|image/g.test(val)) continue;

        if (textArr[this.e.bot.uin].has(tmp[0])) continue;

        textArr[this.e.bot.uin].set(tmp[0], [
          [
            {
              local: `${globalFacePath}/${val}`,
              asface: true,
            },
          ],
        ]);
      }

      this.saveGlobalJson();
    } else {
      fs.mkdirSync(globalFacePath);
    }
  }

  async del () {
    this.isGlobal = this.e?.msg.includes("全局");
    await this.getGroupId()
    if (!this.group_id) return false
    if (!this.checkAuth()) return

    this.initTextArr()

    let keyWord = this.e.toString().replace(/#|＃|图片|表情|删除|全部|全局/g, '')

    keyWord = this.trimAlias(keyWord)

    let num = false
    let index = 0
    if (isNaN(keyWord)) {
      num = keyWord.charAt(keyWord.length - 1)

      if (!isNaN(num) && !textArr[this.group_id].has(keyWord)) {
        keyWord = lodash.trimEnd(keyWord, num).trim()
        index = num - 1
      } else {
        num = false
      }
    }

    let arr = textArr[this.group_id].get(keyWord)
    if (!arr) {
      // await this.e.reply(`暂无此表情：${keyWord}`)
      return false
    }

    let tmp = []
    if (num) {
      if (!arr[index]) {
        // await this.e.reply(`暂无此表情：${keyWord}${num}`)
        return false
      }

      tmp = arr[index]
      arr.splice(index, 1)

      if (arr.length <= 0) {
        textArr[this.group_id].delete(keyWord)
      } else {
        textArr[this.group_id].set(keyWord, arr)
      }
    } else {
      if (this.e.msg.includes('删除全部')) {
        tmp = arr
        arr = []
      } else {
        tmp = arr.pop()
      }

      if (arr.length <= 0) {
        textArr[this.group_id].delete(keyWord)
      } else {
        textArr[this.group_id].set(keyWord, arr)
      }
    }
    if (!num) num = ''

    let retMsg = [{ type: 'text', text: '删除成功：' }]
    for (let msg of this.e.message) {
      if (msg.type == 'text') {
        msg.text = msg.text.replace(/#|＃|图片|表情|删除|全部|全局/g, '')

        if (!msg.text) continue
      }
      retMsg.push(msg)
    }
    if (num > 0) {
      retMsg.push({ type: 'text', text: num })
    }

    await this.e.reply(retMsg)

    /** 删除图片 */
    tmp.forEach(item => {
      let img = item
      if (Array.isArray(item)) {
        img = item[0]
      }
      if (img.local) {
        fs.unlink(img.local, () => {})
      }
    })

    this.saveJson()
  }

  async list () {
    this.isGlobal = this.e?.msg.includes("全局");

    let page = 1
    let pageSize = 100
    let type = 'list'

    await this.getGroupId()
    if (!this.group_id) return false

    this.initTextArr()

    let search = this.e.msg.replace(/#|＃|表情|词条|全局/g, '')

    if (search.includes('列表')) {
      page = search.replace(/列表/g, '') || 1
    } else {
      type = 'search'
    }

    let list = textArr[this.group_id]

    if (lodash.isEmpty(list)) {
      await this.e.reply('暂无表情')
      return
    }

    let arr = []
    for (let [k, v] of textArr[this.group_id]) {
      if (type == 'list') {
        arr.push({ key: k, val: v, num: arr.length + 1 })
      } else if (k.includes(search)) {
        /** 搜索表情 */
        arr.push({ key: k, val: v, num: arr.length + 1 })
      }
    }

    let count = arr.length
    arr = arr.reverse()

    if (type == 'list') {
      arr = this.pagination(page, pageSize, arr)
    }

    if (lodash.isEmpty(arr)) {
      return
    }

    let msg = []
    let num = 0
    for (let i in arr) {
      if (num >= page * pageSize) break

      let keyWord = await this.keyWordTran(arr[i].key)
      if (!keyWord) continue

      if (Array.isArray(keyWord)) {
        keyWord.unshift(`${arr[i].num}、`)
        keyWord.push('\n')
        keyWord.forEach(v => msg.push(v))
      } else if (keyWord.type) {
        msg.push(`\n${arr[i].num}、`, keyWord, '\n\n')
      } else {
        msg.push(`${arr[i].num}、${keyWord}\n`)
      }
      num++
    }

    let end = ''
    if (type == 'list' && count > 100) {
      end = `更多内容请翻页查看\n如：#表情列表${Number(page) + 1}`
    }

    let title = `表情列表，第${page}页，共${count}条`
    if (type == 'search') {
      title = `表情${search}，${count}条`
    }

    let forwardMsg = await this.makeForwardMsg(this.e.bot.uin, title, msg, end)

    this.e.reply(forwardMsg)
  }

  async makeForwardMsg (qq, title, msg, end = '') {
    let nickname = this.e.bot.nickname
    if (this.e.isGroup) {
      let info = await this.e.bot.getGroupMemberInfo(this.e.group_id, qq)
      nickname = info.card ?? info.nickname
    }
    let userInfo = {
      user_id: this.e.bot.uin,
      nickname
    }

    let forwardMsg = [
      {
        ...userInfo,
        message: title
      }
    ]

    let msgArr = lodash.chunk(msg, 40)
    msgArr.forEach(v => {
      v[v.length - 1] = lodash.trim(v[v.length - 1], '\n')
      forwardMsg.push({ ...userInfo, message: v })
    })

    if (end) {
      forwardMsg.push({ ...userInfo, message: end })
    }

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)

    return forwardMsg
  }

  /** 分页 */
  pagination (pageNo, pageSize, array) {
    let offset = (pageNo - 1) * pageSize
    return offset + pageSize >= array.length ? array.slice(offset, array.length) : array.slice(offset, offset + pageSize)
  }

  /** 关键词转换成可发送消息 */
  async keyWordTran (msg) {
    /** 图片 */
    if (msg.includes('{image')) {
      let tmp = msg.split('{image')
      if (tmp.length > 2) return false

      let md5 = tmp[1].replace(/}|_|:/g, '')

      msg = segment.image(`http://gchat.qpic.cn/gchatpic_new/0/0-0-${md5}/0`)
      msg.asface = true
    } else if (msg.includes('{at:')) {
      let tmp = msg.match(/{at:(.+?)}/g)

      for (let qq of tmp) {
        qq = qq.match(/[1-9][0-9]{4,14}/g)[0]
        let member = await await this.e.bot.getGroupMemberInfo(this.group_id, Number(qq)).catch(() => { })
        let name = member?.card ?? member?.nickname
        if (!name) continue
        msg = msg.replace(`{at:${qq}}`, `@${name}`)
      }
    } else if (msg.includes('{face')) {
      let tmp = msg.match(/{face(:|_)(.+?)}/g)
      if (!tmp) return msg
      msg = []
      for (let face of tmp) {
        let id = face.match(/\d+/g)
        msg.push(segment.face(id))
      }
    }

    return msg
  }
}
