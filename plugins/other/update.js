import cfg from '../../lib/config/config.js'
import lodash from 'lodash'
import fs from 'node:fs/promises'
import { Restart } from './restart.js'

let uping = false

export class update extends plugin {
  constructor() {
    super({
      name: '更新',
      dsc: '#更新 #强制更新',
      event: 'message',
      priority: 4000,
      rule: [
        {
          reg: '^#更新日志',
          fnc: 'updateLog'
        },
        {
          reg: '^#(强制)?更新',
          fnc: 'update'
        },
        {
          reg: '^#全部(强制)?更新$',
          fnc: 'updateAll',
          permission: 'master'
        }
      ]
    })

    this.typeName = 'TRSS-Yunzai'
  }

  init() {
    if (cfg.bot.update_time) {
      this.e = {
        isMaster: true,
        logFnc: "[自动更新]",
        msg: "#全部更新",
      }
      this.reply = msg => Bot.sendMasterMsg(msg)
      this.autoUpdate()
    }
  }

  autoUpdate() {
    setTimeout(() => {
      this.updateAll()
      this.autoUpdate()
    }, cfg.bot.update_time*60000)
  }

  async update() {
    if (!this.e.isMaster) return false
    if (uping) return this.reply('已有命令更新中..请勿重复操作')

    if (/详细|详情|面板|面版/.test(this.e.msg)) return false

    /** 获取插件 */
    let plugin = await this.getPlugin()
    if (plugin === false) return false

    await this.runUpdate(plugin)

    /** 是否需要重启 */
    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }
  }

  async getPlugin(plugin = '') {
    if (!plugin) {
      plugin = this.e.msg.replace(/#(强制)?更新(日志)?/, '')
      if (!plugin) return ''
    }

    if (!await Bot.fsStat(`plugins/${plugin}/.git`)) return false

    this.typeName = plugin
    return plugin
  }

  async runUpdate(plugin = '') {
    this.isNowUp = false

    let cm = 'git pull --no-rebase'

    let type = '更新'
    if (this.e.msg.includes('强制')) {
      type = '强制更新'
      cm = `git reset --hard && git pull --rebase --allow-unrelated-histories`
    }
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`

    this.oldCommitId = await this.getcommitId(plugin)

    logger.mark(`${this.e.logFnc} 开始${type}：${this.typeName}`)

    await this.reply(`开始${type} ${this.typeName}`)
    uping = true
    const ret = await Bot.exec(cm)
    uping = false

    ret.stdout = String(ret.stdout)
    if (ret.error) {
      logger.mark(`${this.e.logFnc} 更新失败：${this.typeName}`)
      this.gitErr(Bot.String(ret.error), ret.stdout)
      return false
    }

    const time = await this.getTime(plugin)

    if (/Already up|已经是最新/g.test(ret.stdout)) {
      await this.reply(`${this.typeName} 已是最新\n最后更新时间：${time}`)
    } else {
      await this.reply(`${this.typeName} 更新成功\n更新时间：${time}`)
      this.isUp = true
      await this.reply(await this.getLog(plugin))
    }

    logger.mark(`${this.e.logFnc} 最后更新时间：${time}`)
    return true
  }

  async getcommitId(plugin = '') {
    let cm = 'git rev-parse --short HEAD'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`
    cm = await Bot.exec(cm)
    return lodash.trim(String(cm.stdout))
  }

  async getTime(plugin = '') {
    let cm = 'git log -1 --pretty=%cd --date=format:"%F %T"'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`
    cm = await Bot.exec(cm)
    return lodash.trim(String(cm.stdout))
  }

  async gitErr(error, stdout) {
    const msg = '更新失败！'

    if (error.includes('Timed out')) {
      const remote = error.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接超时：${remote}`)
    }

    if (/Failed to connect|unable to access/g.test(error)) {
      const remote = error.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接失败：${remote}`)
    }

    if (error.includes('be overwritten by merge')) {
      return this.reply(`${msg}\n存在冲突：\n${error}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    if (stdout.includes('CONFLICT')) {
      return this.reply(`${msg}\n存在冲突：\n${error}${stdout}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    return this.reply([error, stdout])
  }

  async updateAll() {
    const dirs = await fs.readdir('./plugins/')

    await this.runUpdate()

    for (let plu of dirs) {
      plu = await this.getPlugin(plu)
      if (plu === false) continue
      await this.runUpdate(plu)
    }

    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }
  }

  restart() {
    new Restart(this.e).restart()
  }

  async getLog(plugin = '') {
    let cm = 'git log -100 --pretty="%h||[%cd] %s" --date=format:"%F %T"'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`

    cm = await Bot.exec(cm)
    if (cm.error) {
      logger.error(cm.error)
      await this.reply(String(cm.error))
    }
    const logAll = String(cm.stdout).trim().split('\n')

    if (!logAll.length) return false

    let log = []
    for (let str of logAll) {
      str = str.split('||')
      if (str[0] == this.oldCommitId) break
      if (str[1].includes('Merge branch')) continue
      log.push(str[1])
    }
    let line = log.length
    log = log.join('\n\n')

    if (log.length <= 0) return ''

    cm = 'git config -l'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`
    cm = await Bot.exec(cm)
    const end = String(cm.stdout).match(/remote\..*\.url=.+/g).join('\n\n').replace(/remote\..*\.url=/g, '').replace(/\/\/([^@]+)@/, '//')
    if (cm.error) {
      logger.error(cm.error)
      await this.reply(String(cm.error))
    }

    return Bot.makeForwardArray([`${plugin || 'TRSS-Yunzai'} 更新日志，共${line}条`, log, end])
  }

  async updateLog() {
    const plugin = await this.getPlugin()
    if (plugin === false) return false
    return this.reply(await this.getLog(plugin))
  }
}
