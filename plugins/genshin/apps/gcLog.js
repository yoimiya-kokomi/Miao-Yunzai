import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'node:fs'
import GachaLog from '../model/gachaLog.js'
import ExportLog from '../model/exportLog.js'
import LogCount from '../model/logCount.js'

const _path = process.cwd() + '/plugins/genshin'

export class gcLog extends plugin {
  constructor () {
    super({
      name: '抽卡记录',
      dsc: '抽卡记录数据统计',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '(.*)authkey=(.*)',
          fnc: 'logUrl'
        },
        {
          reg: '#txt日志文件导入记录',
          fnc: 'logFile'
        },
        {
          reg: '#xlsx文件导入记录',
          fnc: 'logXlsx'
        },
        {
          reg: '#json文件导入记录',
          fnc: 'logJson'
        },
        {
          reg: '^#*(原神|星铁)?(抽卡|抽奖|角色|武器|常驻|up|新手|光锥)池*(记录|祈愿|分析)$',
          fnc: 'getLog'
        },
        {
          reg: '^#*导出记录(excel|xlsx|json)*$',
          fnc: 'exportLog'
        },
        {
          reg: '^#*(记录帮助|抽卡帮助)$',
          fnc: 'help'
        },
        {
          reg: '^#*(安卓|苹果|电脑|pc|ios)帮助$',
          fnc: 'helpPort'
        },
        {
          reg: '^#*(原神|星铁)?(抽卡|抽奖|角色|武器|常驻|up|新手|光锥)池*统计$',
          fnc: 'logCount'
        }
      ]
    })

    this.androidUrl = 'docs.qq.com/doc/DUWpYaXlvSklmVXlX'
    this._path = process.cwd().replace(/\\/g, '/')
  }

  async init () {
    let file = ['./data/gachaJson','./data/srJson','./temp/html/StarRail']
    for(let i of file){
      if (!fs.existsSync(i)) {
        fs.mkdirSync(i)
      }
    }
  }

  accept () {
    if (this.e.file && this.e.isPrivate) {
      let name = this.e.file?.name
      if (name.includes('txt')) {
        this.e.msg = '#txt日志文件导入记录'
        if (name.includes('output')) return true
      }
      if (/(.*)[1-9][0-9]{8}(.*).xlsx$/ig.test(name)) {
        this.e.msg = '#xlsx文件导入记录'
        return true
      }
      if (/(.*)[1-9][0-9]{8}(.*).json/ig.test(name)) {
        this.e.msg = '#json文件导入记录'
        return true
      }
    }
    if (this.e.msg && /^#*(角色|武器)统计$/g.test(this.e.msg)) {
      this.e.msg = this.e.msg.replace('统计', '池统计')
      return true
    }
  }

  /** 抽卡记录链接 */
  async logUrl () {
    if (!this.e.isPrivate) {
      this.e.reply('请私聊发送链接', false, { at: true })
      return true
    }

    let data = await new GachaLog(this.e).logUrl()
    if (!data) return
    let url = this.srHead('gachaLog', data)
    let img = await puppeteer.screenshot(url, data)
    if (img) await this.reply(img)
  }

  /** 发送output_log.txt日志文件 */
  async logFile () {
    if (!this.e.isPrivate) {
      await this.e.reply('请私聊发送日志文件', false, { at: true })
      return true
    }

    if (!this.e.file || !this.e.file.name.includes('txt')) {
      await this.e.reply('请发送日志文件')
    } else {
      await this.e.reply('3.0版本后，日志文件已不能获取抽取记录链接\n请用安卓方式获取')
      return true
    }

    let data = await new GachaLog(this.e).logFile()
    if (!data) return false

    if (typeof data != 'object') return
    let url='gachaLog'
    if(this.e.isSr){
      url ='StarRail/gachaLog'
      data.tplFile = './plugins/genshin/resources/StarRail/html/gachaLog/gachaLog.html'
      data.headStyle =  `<style> .head_box { background: url(${this._path}/plugins/genshin/resources/StarRail/img/worldcard/星穹列车.png) #fff;  background-repeat: no-repeat; background-position-x: -10px; background-size: 500px; background-position-y: -90px; }</style>`
    }
    let img = await puppeteer.screenshot(url, data)
    if (img) await this.reply(img)
  }

  /** #抽卡记录 */
  async getLog () {
    let data = await new GachaLog(this.e).getLogData()
    if (!data) return
    let url = this.srHead('gachaLog', data)
    let img = await puppeteer.screenshot(url, data)
    if (img) await this.reply(img)
  }

  /** 导出记录 */
  async exportLog () {
    if (this.e.isGroup) {
      await this.reply('请私聊导出', false, { at: true })
      return
    }

    let friend = Bot.fl.get(Number(this.e.user_id))
    if (!friend) {
      await this.reply('无法发送文件，请先添加好友')
      return
    }

    let exportLog = new ExportLog(this.e)

    if (this.e.msg.includes('json')) {
      return await exportLog.exportJson()
    } else {
      return await exportLog.exportXlsx()
    }
  }

  async logXlsx () {
    if (!this.e.isPrivate) {
      await this.e.reply('请私聊发送日志文件', false, { at: true })
      return true
    }

    if (!this.e.file) {
      await this.e.reply('请发送xlsx文件')
      return true
    }

    await new ExportLog(this.e).logXlsx()
  }

  async logJson () {
    if (!this.e.isPrivate) {
      await this.e.reply('请私聊发送Json文件', false, { at: true })
      return true
    }

    if (!this.e.file) {
      await this.e.reply('请发送Json文件')
      return true
    }

    await new ExportLog(this.e).logJson()
  }

  async help () {
    await this.e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`))
  }

  async helpPort () {
    let msg = this.e.msg.replace(/#|帮助/g, '')

    if (['电脑', 'pc'].includes(msg)) {
      await this.e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助-电脑.png`))
    } else if (['安卓'].includes(msg)) {
      await this.e.reply(`安卓抽卡记录获取教程：${this.androidUrl}`)
    } else if (['苹果', 'ios'].includes(msg)) {
      await this.e.reply(segment.image(`file:///${_path}/resources/logHelp/记录帮助-苹果.png`))
    }
  }
  srHead = (url, data) => {
    let name = url
    if (this.e.isSr) {
      name = `StarRail/${url}`
      data.tplFile = `./plugins/genshin/resources/StarRail/html/${url}/${url}.html`
      data.headStyle = `<style> .head_box { background: url(${this._path}/plugins/genshin/resources/StarRail/img/worldcard/星穹列车.png) #fff; background-position-x: -10px; background-repeat: no-repeat; background-size: 540px; background-position-y: -100px; </style>`
    }
    return name
  }
  async logCount () {
    let data = await new LogCount(this.e).count()
    if (!data) return
    let url = this.srHead('logCount', data)
    let img = await puppeteer.screenshot(url, data)
    if (img) await this.reply(img)
  }
}
