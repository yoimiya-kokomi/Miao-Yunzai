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
  constructor () {
    super({
      name: '更新',
      dsc: '#更新 #强制更新',
      event: 'message',
      priority: 4000,
      rule: [
        {
          reg: '^#更新日志$',
          fnc: 'updateLog'
        },
        {
          reg: '^#(强制)*更新(.*)',
          fnc: 'update'
        },
        {
          reg: '^#全部更新$',
          fnc: 'updateAll',
          permission: 'master'
        }
      ]
    })

    this.typeName = 'Miao-Yunzai'
  }

  async update () {
    if (!this.e.isMaster) return false
    if (uping) {
      await this.reply('已有命令更新中..请勿重复操作')
      return
    }

    if (/详细|详情|面板|面版/.test(this.e.msg)) return false

    /** 获取插件 */
    let plugin = this.getPlugin()

    if (plugin === false) return false

    /** 检查git安装 */
    if (!await this.checkGit()) return

    /** 执行更新 */
    await this.runUpdate(plugin)

    /** 是否需要重启 */
    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }
  }

  async checkGit () {
    let ret = await execSync('git --version', { encoding: 'utf-8' })
    if (!ret || !ret.includes('git version')) {
      await this.reply('请先安装git')
      return false
    }

    return true
  }

  getPlugin (plugin = '') {
    if (!plugin) {
      plugin = this.e.msg.replace(/#|更新|强制/g, '')
      if (!plugin) return ''
    }

    let path = `./plugins/${plugin}/.git`

    if (!fs.existsSync(path)) return false

    this.typeName = plugin
    return plugin
  }

  async execSync (cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
  }

  async runUpdate (plugin = '') {
    this.isNowUp = false

    let cm = 'git pull --no-rebase'

    let type = '更新'
    if (this.e.msg.includes('强制')) {
      type = '强制更新'
      cm = `git reset --hard origin/master && ${cm}`
    }

    if (plugin) {
      cm = `git -C ./plugins/${plugin}/ pull --no-rebase`
    }

    this.oldCommitId = await this.getcommitId(plugin)

    logger.mark(`${this.e.logFnc} 开始${type}：${this.typeName}`)

    await this.reply(`开始#${type}${this.typeName}`)
    uping = true
    let ret = await this.execSync(cm)
    uping = false

    if (ret.error) {
      logger.mark(`${this.e.logFnc} 更新失败：${this.typeName}`)
      this.gitErr(ret.error, ret.stdout)
      return false
    }

    let time = await this.getTime(plugin)

    if (/Already up|已经是最新/g.test(ret.stdout)) {
      await this.reply(`${this.typeName}已经是最新\n最后更新时间：${time}`)
    } else {
      await this.reply(`${this.typeName}更新成功\n更新时间：${time}`)
      this.isUp = true
      let log = await this.getLog(plugin)
      await this.reply(log)
    }

    logger.mark(`${this.e.logFnc} 最后更新时间：${time}`)

    return true
  }

  async getcommitId (plugin = '') {
    let cm = 'git rev-parse --short HEAD'
    if (plugin) {
      cm = `git -C ./plugins/${plugin}/ rev-parse --short HEAD`
    }

    let commitId = await execSync(cm, { encoding: 'utf-8' })
    commitId = lodash.trim(commitId)

    return commitId
  }

  async getTime (plugin = '') {
    let cm = 'git log  -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"'
    if (plugin) {
      cm = `cd ./plugins/${plugin}/ && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`
    }

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

  async gitErr (err, stdout) {
    let msg = '更新失败！'
    let errMsg = err.toString()
    stdout = stdout.toString()

    if (errMsg.includes('Timed out')) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      await this.reply(msg + `\n连接超时：${remote}`)
      return
    }

    if (/Failed to connect|unable to access/g.test(errMsg)) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      await this.reply(msg + `\n连接失败：${remote}`)
      return
    }

    if (errMsg.includes('be overwritten by merge')) {
      await this.reply(msg + `存在冲突：\n${errMsg}\n` + '请解决冲突后再更新，或者执行#强制更新，放弃本地修改')
      return
    }

    if (stdout.includes('CONFLICT')) {
      await this.reply([msg + '存在冲突\n', errMsg, stdout, '\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改'])
      return
    }

    await this.reply([errMsg, stdout])
  }

  async updateAll () {
    let dirs = fs.readdirSync('./plugins/')

    await this.runUpdate()

    for (let plu of dirs) {
      plu = this.getPlugin(plu)
      if (plu === false) continue
      await common.sleep(1500)
      await this.runUpdate(plu)
    }

    if (this.isUp) {
      // await this.reply('即将执行重启，以应用更新')
      setTimeout(() => this.restart(), 2000)
    }
  }

  restart () {
    new Restart(this.e).restart()
  }

  async getLog (plugin = '') {
    let cm = 'git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"'
    if (plugin) {
      cm = `cd ./plugins/${plugin}/ && ${cm}`
    }

    let logAll
    try {
      logAll = await execSync(cm, { encoding: 'utf-8' })
    } catch (error) {
      logger.error(error.toString())
      this.reply(error.toString())
    }

    if (!logAll) return false

    logAll = logAll.split('\n')

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

    log = await this.makeForwardMsg(`${plugin || 'Miao-Yunzai'}更新日志，共${line}条`, log, end)

    return log
  }

  async makeForwardMsg (title, msg, end) {
    let nickname = this.e.bot.nickname
    if (this.e.isGroup) {
      let info = await this.e.bot.getGroupMemberInfo(this.e.group_id, this.e.bot.uin)
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
      },
      {
        ...userInfo,
        message: msg
      }
    ]

    if (end) {
      forwardMsg.push({
        ...userInfo,
        message: end
      })
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

  async updateLog () {
    let log = await this.getLog()
    await this.reply(log)
  }
}
