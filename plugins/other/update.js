import plugin from '../../lib/plugins/plugin.js'
import { createRequire } from 'module'
import lodash from 'lodash'
import fs from 'node:fs'
import { Restart } from './restart.js'
import common from '../../lib/common/common.js'

const require = createRequire(import.meta.url)
const { exec, execSync } = require('child_process')

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
          reg: '^#(静默)?全部(强制)?更新$',
          fnc: 'updateAll',
          permission: 'master'
        }
      ]
    })

    this.typeName = 'Miao-Yunzai'
    this.messages = []
  }

  async update() {
    if (!this.e.isMaster) return false
    if (uping) return this.reply('已有命令更新中..请勿重复操作')

    if (/详细|详情|面板|面版/.test(this.e.msg)) return false

    /** 获取插件 */
    let plugin = this.getPlugin()
    if (plugin === false) return false

    /** 执行更新 */
    if (plugin === '') {
      await this.runUpdate('')
      await common.sleep(1000)
      plugin = this.getPlugin('miao-plugin')
      await this.runUpdate(plugin)
    } else {
      await this.runUpdate(plugin)
    }

    /** 是否需要重启 */
    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }
  }

  getPlugin(plugin = '') {
    if (!plugin) {
      plugin = this.e.msg.replace(/#(强制)?更新(日志)?/, '')
      if (!plugin) return ''
    }

    if (!fs.existsSync(`plugins/${plugin}/.git`)) return false

    this.typeName = plugin
    return plugin
  }

  async execSync(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
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
    const ret = await this.execSync(cm)
    uping = false

    if (ret.error) {
      logger.mark(`${this.e.logFnc} 更新失败：${this.typeName}`)
      this.gitErr(ret.error, ret.stdout)
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

    const commitId = await execSync(cm, { encoding: 'utf-8' })
    return lodash.trim(commitId)
  }

  async getTime(plugin = '') {
    let cm = 'git log -1 --pretty=%cd --date=format:"%F %T"'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`

    let time = ''
    try {
      time = await execSync(cm, { encoding: 'utf-8' })
      time = lodash.trim(time)
    } catch (error) {
      logger.error(error.toString())
      time = '获取时间失败'
    }

    return time
  }

  async gitErr(err, stdout) {
    const msg = '更新失败！'
    const errMsg = err.toString()
    stdout = stdout.toString()

    if (errMsg.includes('Timed out')) {
      const remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接超时：${remote}`)
    }

    if (/Failed to connect|unable to access/g.test(errMsg)) {
      const remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接失败：${remote}`)
    }

    if (errMsg.includes('be overwritten by merge')) {
      return this.reply(`${msg}\n存在冲突：\n${errMsg}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    if (stdout.includes('CONFLICT')) {
      return this.reply(`${msg}\n存在冲突：\n${errMsg}${stdout}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    return this.reply([errMsg, stdout])
  }

  async updateAll() {
    const dirs = fs.readdirSync('./plugins/')

    const originalReply = this.reply

    const testReg = /^#静默全部(强制)?更新$/.test(this.e.msg)
    if (testReg) {
      await this.reply(`开始执行静默全部更新,请稍等...`)
      this.reply = (message) => {
        this.messages.push(message)
      }
    }

    await this.runUpdate()

    for (let plu of dirs) {
      plu = this.getPlugin(plu)
      if (plu === false) continue
      await common.sleep(1500)
      await this.runUpdate(plu)
    }

    if (testReg) {
      await this.reply(await common.makeForwardMsg(this.e, this.messages))
    }

    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }

    this.reply = originalReply
  }

  restart() {
    new Restart(this.e).restart()
  }

  async getLog(plugin = '') {
    let cm = 'git log -100 --pretty="%h||[%cd] %s" --date=format:"%F %T"'
    if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`

    let logAll
    try {
      logAll = await execSync(cm, { encoding: 'utf-8' })
    } catch (error) {
      logger.error(error.toString())
      await this.reply(error.toString())
    }

    if (!logAll) return false

    logAll = logAll.trim().split('\n')

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

    let end = ''
    try {
      cm = 'git config -l'
      if (plugin) cm = `cd "plugins/${plugin}" && ${cm}`
      end = await execSync(cm, { encoding: 'utf-8' })
      end = end.match(/remote\..*\.url=.+/g).join('\n\n').replace(/remote\..*\.url=/g, '').replace(/\/\/([^@]+)@/, '//')
    } catch (error) {
      logger.error(error.toString())
      await this.reply(error.toString())
    }

    return common.makeForwardMsg(this.e, [log, end], `${plugin || 'Miao-Yunzai'} 更新日志，共${line}条`)
  }

  async updateLog() {
    const plugin = this.getPlugin()
    if (plugin === false) return false
    return this.reply(await this.getLog(plugin))
  }
}
