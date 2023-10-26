import util from 'node:util'
import fs from 'node:fs'
import lodash from 'lodash'
import cfg from '../config/config.js'
import plugin from './plugin.js'
import schedule from 'node-schedule'
import { segment } from 'icqq'
import chokidar from 'chokidar'
import moment from 'moment'
import path from 'node:path'
import common from '../common/common.js'
import Runtime from './runtime.js'
import Handler from './handler.js'

/** 全局变量 plugin */
global.plugin = plugin
global.segment = segment

/**
 * 加载插件
 */
class PluginsLoader {
  constructor () {
    this.priority = []
    this.handler = {}
    this.task = []
    this.dir = './plugins'

    /** 命令冷却cd */
    this.groupGlobalCD = {}
    this.singleCD = {}

    /** 插件监听 */
    this.watcher = {}

    this.msgThrottle = {}

    /** 星铁命令前缀 */
    this.srReg = /^#?(\*|星铁|星轨|穹轨|星穹|崩铁|星穹铁道|崩坏星穹铁道|铁道)+/
  }

  /**
   * 监听事件加载
   * @param isRefresh 是否刷新
   */
  async load (isRefresh = false) {
    this.delCount()
    if (!lodash.isEmpty(this.priority) && !isRefresh) return

    const files = this.getPlugins()

    logger.info('加载插件中..')

    let pluCount = 0

    let packageErr = []
    for (let File of files) {
      try {
        let tmp = await import(File.path)
        let apps = tmp
        if (tmp.apps) {
          apps = { ...tmp.apps }
        }
        lodash.forEach(apps, (p, i) => {
          if (!p.prototype) return
          pluCount++
          /* eslint-disable new-cap */
          let plugin = new p()
          logger.debug(`载入插件 [${File.name}][${plugin.name}]`)
          /** 执行初始化 */
          this.runInit(plugin)
          /** 初始化定时任务 */
          this.collectTask(plugin.task)
          this.priority.push({
            class: p,
            key: File.name,
            name: plugin.name,
            priority: plugin.priority
          })
          if (plugin.handler) {
            lodash.forEach(plugin.handler, ({ fn, key, priority }) => {
              Handler.add({
                ns: plugin.namespace || File.name,
                key: key,
                self: plugin,
                property: priority || plugin.priority || 500,
                fn: plugin[fn]
              })
            })
          }
        })
      } catch (error) {
        if (error.stack.includes('Cannot find package')) {
          packageErr.push({ error, File })
        } else {
          logger.error(`载入插件错误：${logger.red(File.name)}`)
          logger.error(decodeURI(error.stack))
        }
      }
    }

    this.packageTips(packageErr)
    this.creatTask()

    logger.info(`加载定时任务[${this.task.length}个]`)
    logger.info(`加载插件完成[${pluCount}个]`)
    logger.info('-----------')

    /** 优先级排序 */
    this.priority = lodash.orderBy(this.priority, ['priority'], ['asc'])
  }

  async runInit (plugin) {
    plugin.init && plugin.init()
  }

  packageTips (packageErr) {
    if (!packageErr || packageErr.length <= 0) return
    logger.mark('--------插件载入错误--------')
    packageErr.forEach(v => {
      let pack = v.error.stack.match(/'(.+?)'/g)[0].replace(/'/g, '')
      logger.mark(`${v.File.name} 缺少依赖：${logger.red(pack)}`)
      logger.mark(`新增插件后请执行安装命令：${logger.red('pnpm install -P')} 安装依赖`)
      logger.mark(`如安装后仍未解决可联系插件作者将 ${logger.red(pack)} 依赖添加至插件的package.json dependencies中，或手工安装依赖`)
    })
    // logger.error('或者使用其他包管理工具安装依赖')
    logger.mark('---------------------')
  }

  getPlugins () {
    let ignore = ['index.js']
    let files = fs.readdirSync(this.dir, { withFileTypes: true })
    let ret = []
    for (let val of files) {
      let filepath = '../../plugins/' + val.name
      let tmp = {
        name: val.name
      }
      if (val.isFile()) {
        if (!val.name.endsWith('.js')) continue
        if (ignore.includes(val.name)) continue
        tmp.path = filepath
        ret.push(tmp)
        continue
      }

      if (fs.existsSync(`${this.dir}/${val.name}/index.js`)) {
        tmp.path = filepath + '/index.js'
        ret.push(tmp)
        continue
      }

      let apps = fs.readdirSync(`${this.dir}/${val.name}`, { withFileTypes: true })
      for (let app of apps) {
        if (!app.name.endsWith('.js')) continue
        if (ignore.includes(app.name)) continue

        ret.push({
          name: `${val.name}/${app.name}`,
          path: `../../plugins/${val.name}/${app.name}`
        })

        /** 监听热更新 */
        this.watch(val.name, app.name)

      }
    }

    return ret
  }

  /**
   * 处理事件
   *
   * 参数文档 https://oicqjs.github.io/oicq/interfaces/GroupMessageEvent.html
   * @param e icqq Events
   */
  async deal (e) {
    Object.defineProperty(e, 'bot', {
      value: Bot
    })
    /** 检查频道消息 */
    if (this.checkGuildMsg(e)) return

    /** 冷却 */
    if (!this.checkLimit(e)) return
    /** 处理消息 */
    this.dealMsg(e)
    /** 检查黑白名单 */
    if (!this.checkBlack(e)) return
    /** 处理回复 */
    this.reply(e)
    /** 过滤事件 */
    let priority = []
    /** 注册runtime */
    await Runtime.init(e)

    this.priority.forEach(v => {
      let p = new v.class(e)
      p.e = e
      /** 判断是否启用功能 */
      if (!this.checkDisable(e, p)) return
      /** 过滤事件 */
      if (!this.filtEvent(e, p)) return
      priority.push(p)
    })

    for (let plugin of priority) {
      /** 上下文hook */
      if (plugin.getContext) {
        let context = plugin.getContext()
        if (!lodash.isEmpty(context)) {
          for (let fnc in context) {
            plugin[fnc](context[fnc])
          }
          return
        }
      }

      /** 群上下文hook */
      if (plugin.getContextGroup) {
        let context = plugin.getContextGroup()
        if (!lodash.isEmpty(context)) {
          for (let fnc in context) {
            plugin[fnc](context[fnc])
          }
          return
        }
      }
    }

    /** 是否只关注主动at */
    if (!this.onlyReplyAt(e)) return

    // 判断是否是星铁命令，若是星铁命令则标准化处理
    // e.isSr = true，且命令标准化为 #星铁 开头
    Object.defineProperty(e, 'isSr', {
      get: () => e.game === 'sr',
      set: (v) => e.game = v ? 'sr' : 'gs'
    })
    Object.defineProperty(e, 'isGs', {
      get: () => e.game === 'gs',
      set: (v) => e.game = v ? 'gs' : 'sr'
    })
    if (this.srReg.test(e.msg)) {
      e.game = 'sr'
      e.msg = e.msg.replace(this.srReg, '#星铁')
    }

    /** accept */
    for (let plugin of priority) {
      /** accept hook */
      if (plugin.accept) {
        let res = plugin.accept(e)

        if (util.types.isPromise(res)) res = await res

        if (res === 'return') return

        if (res) break
      }
    }

    /* eslint-disable no-labels */
    a:
      for (let plugin of priority) {
        /** 正则匹配 */
        if (plugin.rule) {
          for (let v of plugin.rule) {
            /** 判断事件 */
            if (v.event && !this.filtEvent(e, v)) continue

            const regExp = new RegExp(v.reg)
            /**  匹配消息或者小程序 */
            const messageOrApplet = e.msg || e.message?.[0]?.data
            if (regExp.test(messageOrApplet)) {
              e.logFnc = `[${plugin.name}][${v.fnc}]`

              if (v.log !== false) {
                logger.mark(`${e.logFnc}${e.logText} ${lodash.truncate(e.msg, { length: 80 })}`)
              }

              /** 判断权限 */
              if (!this.filtPermission(e, v)) break a

              try {
                let res = plugin[v.fnc] && plugin[v.fnc](e)

                let start = Date.now()

                if (util.types.isPromise(res)) res = await res

                if (res !== false) {
                  /** 设置冷却cd */
                  this.setLimit(e)
                  if (v.log !== false) {
                    logger.mark(`${e.logFnc} ${lodash.truncate(e.msg, { length: 80 })} 处理完成 ${Date.now() - start}ms`)
                  }
                  break a
                }
              } catch (error) {
                logger.error(`${e.logFnc}`)
                logger.error(error.stack)
                break a
              }
            }
          }
        }
      }
  }

  /** 过滤事件 */
  filtEvent (e, v) {
    if (!v.event) {
      return false
    }
    let event = v.event.split('.')
    let eventMap = {
      message: ['post_type', 'message_type', 'sub_type'],
      notice: ['post_type', 'notice_type', 'sub_type'],
      request: ['post_type', 'request_type', 'sub_type']
    }
    let newEvent = []
    event.forEach((val, index) => {
      if (val === '*') {
        newEvent.push(val)
      } else if (eventMap[e.post_type]) {
        newEvent.push(e[eventMap[e.post_type][index]])
      }
    })
    newEvent = newEvent.join('.')

    return v.event === newEvent
  }

  /** 判断权限 */
  filtPermission (e, v) {
    if (v.permission == 'all' || !v.permission) return true

    if (v.permission == 'master') {
      if (e.isMaster) {
        return true
      } else {
        e.reply('暂无权限，只有主人才能操作')
        return false
      }
    }

    if (e.isGroup) {
      if (!e.member?._info) {
        e.reply('数据加载中，请稍后再试')
        return false
      }
      if (v.permission === 'owner') {
        if (!e.member.is_owner) {
          e.reply('暂无权限，只有群主才能操作')
          return false
        }
      }
      if (v.permission === 'admin') {
        if (!e.member.is_admin) {
          e.reply('暂无权限，只有管理员才能操作')
          return false
        }
      }
    }

    return true
  }

  /**
   * 处理消息，加入自定义字段
   * @param e.msg 文本消息，多行会自动拼接
   * @param e.img 图片消息数组
   * @param e.atBot 是否at机器人
   * @param e.at 是否at，多个at 以最后的为准
   * @param e.file 接受到的文件
   * @param e.isPrivate 是否私聊
   * @param e.isGroup 是否群聊
   * @param e.isMaster 是否管理员
   * @param e.logText 日志用户字符串
   * @param e.logFnc  日志方法字符串

   * 频道
   * @param e.isGuild 是否频道
   * @param e.at 支持频道 tiny_id
   * @param e.atBot 支持频道

   */
  dealMsg (e) {
    if (e.message) {
      for (let val of e.message) {
        switch (val.type) {
          case 'text':
            e.msg = (e.msg || '') + (val.text || '').replace(/^\s*[＃井#]+\s*/, '#').replace(/^\s*[\\*※＊]+\s*/, '*').trim()
            break
          case 'image':
            if (!e.img) {
              e.img = []
            }
            e.img.push(val.url)
            break
          case 'at':
            if (val.qq == e.bot.uin) {
              e.atBot = true
            } else if (val.id == e.bot.tiny_id) {
              e.atBot = true
              /** 多个at 以最后的为准 */
            } else if (val.id) {
              e.at = val.id
            } else {
              e.at = val.qq
            }
            break
          case 'file':
            e.file = { name: val.name, fid: val.fid }
            break
        }
      }
    }

    e.logText = ''

    if (e.message_type === 'private' || e.notice_type === 'friend') {
      e.isPrivate = true

      if (e.sender) {
        e.sender.card = e.sender.nickname
      } else {
        e.sender = {
          card: e.friend?.nickname,
          nickname: e.friend?.nickname
        }
      }

      e.logText = `[私聊][${e.sender.nickname}(${e.user_id})]`
    }

    if (e.message_type === 'group' || e.notice_type === 'group') {
      e.isGroup = true
      if (e.sender) {
        e.sender.card = e.sender.card || e.sender.nickname
      } else if (e.member) {
        e.sender = {
          card: e.member.card || e.member.nickname
        }
      } else if (e.nickname) {
        e.sender = {
          card: e.nickname,
          nickname: e.nickname
        }
      } else {
        e.sender = {
          card: '',
          nickname: ''
        }
      }

      if (!e.group_name) e.group_name = e.group?.name

      e.logText = `[${e.group_name}(${e.sender.card})]`
    } else if (e.detail_type === 'guild') {
      e.isGuild = true
    }

    if (e.user_id && cfg.masterQQ.includes(Number(e.user_id) || e.user_id)) {
      e.isMaster = true
    }

    /** 只关注主动at msg处理 */
    if (e.msg && e.isGroup) {
      let groupCfg = cfg.getGroup(e.group_id)
      let alias = groupCfg.botAlias
      if (!Array.isArray(alias)) {
        alias = [alias]
      }
      for (let name of alias) {
        if (e.msg.startsWith(name)) {
          e.msg = lodash.trimStart(e.msg, name).trim()
          e.hasAlias = true
          break
        }
      }
    }
  }

  /** 处理回复,捕获发送失败异常 */
  reply (e) {
    if (e.reply) {
      e.replyNew = e.reply

      /**
       * @param msg 发送的消息
       * @param quote 是否引用回复
       * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
       * @param data.at 是否at用户
       */
      e.reply = async (msg = '', quote = false, data = {}) => {
        if (!msg) return false

        /** 禁言中 */
        if (e.isGroup && e?.group?.mute_left > 0) return false

        let { recallMsg = 0, at = '' } = data

        if (at && e.isGroup) {
          let text = ''
          if (e?.sender?.card) {
            text = lodash.truncate(e.sender.card, { length: 10 })
          }
          if (at === true) {
            at = Number(e.user_id) || e.user_id
          } else if (!isNaN(at)) {
            if (e.isGuild) {
              text = e.sender?.nickname
            } else {
              let info = e.group.pickMember(at).info
              text = info?.card ?? info?.nickname
            }
            text = lodash.truncate(text, { length: 10 })
          }

          if (Array.isArray(msg)) {
            msg = [segment.at(at, text), ...msg]
          } else {
            msg = [segment.at(at, text), msg]
          }
        }

        let msgRes
        try {
          msgRes = await e.replyNew(msg, quote)
        } catch (err) {
          if (typeof msg != 'string') {
            if (msg.type == 'image' && Buffer.isBuffer(msg?.file)) msg.file = {}
            msg = lodash.truncate(JSON.stringify(msg), { length: 300 })
          }
          logger.error(`发送消息错误:${msg}`)
          logger.error(err)
        }

        // 频道一下是不是频道
        if (!e.isGuild && recallMsg > 0 && msgRes?.message_id) {
          if (e.isGroup) {
            setTimeout(() => e.group.recallMsg(msgRes.message_id), recallMsg * 1000)
          } else if (e.friend) {
            setTimeout(() => e.friend.recallMsg(msgRes.message_id), recallMsg * 1000)
          }
        }

        this.count(e, msg)
        return msgRes
      }
    } else {
      e.reply = async (msg = '', quote = false, data = {}) => {
        if (!msg) return false
        this.count(e, msg)
        if (e.group_id) {
          return await e.group.sendMsg(msg).catch((err) => {
            logger.warn(err)
          })
        } else {
          let friend = e.bot.fl.get(e.user_id)
          if (!friend) return
          return await e.bot.pickUser(e.user_id).sendMsg(msg).catch((err) => {
            logger.warn(err)
          })
        }
      }
    }
  }

  count (e, msg) {
    let screenshot = false
    if (msg && msg?.file && Buffer.isBuffer(msg?.file)) {
      screenshot = true
    }

    this.saveCount('sendMsg')
    if (screenshot) this.saveCount('screenshot')

    if (e.group_id) {
      this.saveCount('sendMsg', e.group_id)
      if (screenshot) this.saveCount('screenshot', e.group_id)
    }
  }

  saveCount (type, groupId = '') {
    let key = 'Yz:count:'

    if (groupId) {
      key += `group:${groupId}:`
    }

    let dayKey = `${key}${type}:day:${moment().format('MMDD')}`
    let monthKey = `${key}${type}:month:${Number(moment().month()) + 1}`
    let totalKey = `${key}${type}:total`

    redis.incr(dayKey)
    redis.incr(monthKey)
    if (!groupId) redis.incr(totalKey)
    redis.expire(dayKey, 3600 * 24 * 30)
    redis.expire(monthKey, 3600 * 24 * 30)
  }

  delCount () {
    let key = 'Yz:count:'
    redis.set(`${key}sendMsg:total`, '0')
    redis.set(`${key}screenshot:total`, '0')
  }

  /** 收集定时任务 */
  collectTask (task) {
    if (Array.isArray(task)) {
      task.forEach((val) => {
        if (!val.cron) return
        if (!val.name) throw new Error('插件任务名称错误')
        this.task.push(val)
      })
    } else {
      if (task.fnc && task.cron) {
        if (!task.name) throw new Error('插件任务名称错误')
        this.task.push(task)
      }
    }
  }

  /** 创建定时任务 */
  creatTask () {
    if (process.argv[1].includes('test')) return
    this.task.forEach((val) => {
      val.job = schedule.scheduleJob(val.cron, async () => {
        try {
          if (val.log === true) {
            logger.mark(`开始定时任务：${val.name}`)
          }
          let res = val.fnc()
          if (util.types.isPromise(res)) res = await res
          if (val.log === true) {
            logger.mark(`定时任务完成：${val.name}`)
          }
        } catch (error) {
          logger.error(`定时任务报错：${val.name}`)
          logger.error(error)
        }
      })
    })
  }

  /** 检查命令冷却cd */
  checkLimit (e) {
    /** 禁言中 */
    if (e.isGroup && e?.group?.mute_left > 0) return false
    if (!e.message || e.isPrivate) return true

    let config = cfg.getGroup(e.group_id)

    if (config.groupGlobalCD && this.groupGlobalCD[e.group_id]) {
      return false
    }
    if (config.singleCD && this.singleCD[`${e.group_id}.${e.user_id}`]) {
      return false
    }

    let { msgThrottle } = this

    let msgId = e.user_id + ':' + e.raw_message
    if (msgThrottle[msgId]) {
      return false
    }
    msgThrottle[msgId] = true
    setTimeout(() => {
      delete msgThrottle[msgId]
    }, 200)

    return true
  }

  /** 设置冷却cd */
  setLimit (e) {
    if (!e.message || e.isPrivate) return
    let config = cfg.getGroup(e.group_id)

    if (config.groupGlobalCD) {
      this.groupGlobalCD[e.group_id] = true
      setTimeout(() => {
        delete this.groupGlobalCD[e.group_id]
      }, config.groupGlobalCD)
    }
    if (config.singleCD) {
      let key = `${e.group_id}.${e.user_id}`
      this.singleCD[key] = true
      setTimeout(() => {
        delete this.singleCD[key]
      }, config.singleCD)
    }
  }

  /** 是否只关注主动at */
  onlyReplyAt (e) {
    if (!e.message || e.isPrivate) return true

    let groupCfg = cfg.getGroup(e.group_id)

    if (groupCfg.onlyReplyAt != 1 || !groupCfg.botAlias) return true

    /** at机器人 */
    if (e.atBot) return true

    /** 消息带前缀 */
    if (e.hasAlias) return true

    return false
  }

  /** 判断频道消息 */
  checkGuildMsg (e) {
    return cfg.getOther().disableGuildMsg && e.detail_type == 'guild'
  }

  /** 判断黑白名单 */
  checkBlack (e) {
    let other = cfg.getOther()
    let notice = cfg.getNotice()

    if (e.test) return true

    /** 黑名单qq */
    if (other.blackQQ) {
      if (other.blackQQ.includes(Number(e.user_id) || e.user_id)) {
        return false
      }
      if (e.at && other.blackQQ.includes(Number(e.at) || e.at)) {
        return false
      }
    }

    if (e.group_id) {
      /** 白名单群 */
      if (Array.isArray(other.whiteGroup) && other.whiteGroup.length > 0) {
        return other.whiteGroup.includes(Number(e.group_id) || e.group_id)
      }
      /** 黑名单群 */
      if (Array.isArray(other.blackGroup) && other.blackGroup.length > 0) {
        return !other.blackGroup.includes(Number(e.group_id) || e.group_id)
      }
    }

    return true
  }

  /** 判断是否启用功能 */
  checkDisable (e, p) {
    let groupCfg = cfg.getGroup(e.group_id)
    if (!lodash.isEmpty(groupCfg.enable)) {
      if (groupCfg.enable.includes(p.name)) {
        return true
      }
      // logger.debug(`${e.logText}[${p.name}]功能已禁用`)
      return false
    }

    if (!lodash.isEmpty(groupCfg.disable)) {
      if (groupCfg.disable.includes(p.name)) {
        // logger.debug(`${e.logText}[${p.name}]功能已禁用`)
        return false
      }

      return true
    }
    return true
  }

  /** 监听热更新 */
  watch (dirName, appName) {
    this.watchDir(dirName)
    if (this.watcher[`${dirName}.${appName}`]) return

    let file = `./plugins/${dirName}/${appName}`
    const watcher = chokidar.watch(file)
    let key = `${dirName}/${appName}`

    /** 监听修改 */
    watcher.on('change', async path => {
      logger.mark(`[修改插件][${dirName}][${appName}]`)

      let tmp = {}
      try {
        tmp = await import(`../../plugins/${dirName}/${appName}?${moment().format('x')}`)
      } catch (error) {
        logger.error(`载入插件错误：${logger.red(dirName + '/' + appName)}`)
        logger.error(decodeURI(error.stack))
        return
      }

      if (tmp.apps) tmp = { ...tmp.apps }
      lodash.forEach(tmp, (p) => {
        /* eslint-disable new-cap */
        let plugin = new p()
        for (let i in this.priority) {
          if (this.priority[i].key === key) {
            this.priority[i].class = p
            this.priority[i].priority = plugin.priority
          }
        }


        if (plugin.handler) {
          lodash.forEach(plugin.handler, ({ fn, key, priority }) => {
            Handler.add({
              ns: plugin.namespace || File.name,
              key: key,
              self: plugin,
              property: priority || plugin.priority || 500,
              fn: plugin[fn]
            })
          })
        }
      })

      this.priority = lodash.orderBy(this.priority, ['priority'], ['asc'])
    })

    /** 监听删除 */
    watcher.on('unlink', async path => {
      logger.mark(`[卸载插件][${dirName}][${appName}]`)
      for (let i in this.priority) {
        if (this.priority[i].key == key) {
          this.priority.splice(i, 1)
          /** 停止更新监听 */
          this.watcher[`${dirName}.${appName}`].removeAllListeners('change')
          break
        }
      }
    })

    this.watcher[`${dirName}.${appName}`] = watcher
  }

  /** 监听文件夹更新 */
  watchDir (dirName) {
    if (this.watcher[dirName]) return

    let file = `./plugins/${dirName}/`
    const watcher = chokidar.watch(file)

    /** 热更新 */
    setTimeout(() => {
      /** 新增文件 */
      watcher.on('add', async PluPath => {
        let appName = path.basename(PluPath)
        if (!appName.endsWith('.js')) return
        if (!fs.existsSync(`${this.dir}/${dirName}/${appName}`)) return

        let key = `${dirName}/${appName}`

        this.watch(dirName, appName)

        /** 太快了延迟下 */
        await common.sleep(500)

        logger.mark(`[新增插件][${dirName}][${appName}]`)
        let tmp = {}
        try {
          tmp = await import(`../../plugins/${dirName}/${appName}?${moment().format('X')}`)
        } catch (error) {
          logger.error(`载入插件错误：${logger.red(dirName + '/' + appName)}`)
          logger.error(decodeURI(error.stack))
          return
        }

        if (tmp.apps) tmp = { ...tmp.apps }

        lodash.forEach(tmp, (p) => {
          if (!p.prototype) {
            logger.error(`[载入失败][${dirName}][${appName}] 格式错误已跳过`)
            return
          }
          /* eslint-disable new-cap */
          let plugin = new p()

          for (let i in this.priority) {
            if (this.priority[i].key == key) {
              return
            }
          }

          this.priority.push({
            class: p,
            key,
            name: plugin.name,
            priority: plugin.priority
          })
        })

        /** 优先级排序 */
        this.priority = lodash.orderBy(this.priority, ['priority'], ['asc'])
      })
    }, 500)

    this.watcher[dirName] = watcher
  }
}

export default new PluginsLoader()
