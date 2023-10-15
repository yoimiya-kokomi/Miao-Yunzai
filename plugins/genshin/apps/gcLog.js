import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'node:fs'
import GachaLog from '../model/gachaLog.js'
import ExportLog from '../model/exportLog.js'
import LogCount from '../model/logCount.js'

const _path = process.cwd() + '/plugins/genshin'

export class gcLog extends plugin {
  constructor() {
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
          reg: '^#txt(日志)?(文件)?导入记录$',
          fnc: 'logFile'
        },
        {
          reg: '^#*(原神|星铁)?(xlsx|excel)(文件)?导入记录$',
          fnc: 'logXlsx'
        },
        {
          reg: '^#*(原神|星铁)?json(文件)?导入记录$',
          fnc: 'logJson'
        },
        {
          reg: '^#*(原神|星铁)?(全部)?(抽卡|抽奖|角色|武器|常驻|up|新手|光锥|全部)池*(记录|祈愿|分析)$',
          fnc: 'getLog'
        },
        {
          reg: '^#*(原神|星铁)?导出记录(excel|xlsx|json)*$',
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

    this.androidUrl = 'https://docs.qq.com/doc/DUWpYaXlvSklmVXlX'
  }

  async init() {
    let file = ['./data/gachaJson', './data/srJson', './temp/html/StarRail']
    for (let i of file) {
      if (!fs.existsSync(i)) {
        fs.mkdirSync(i)
      }
    }
  }

  accept() {
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
  async logUrl() {
    if (!this.e.isPrivate) {
      this.e.reply('请私聊发送链接', false, { at: true })
      return true
    }

    let data = await new GachaLog(this.e).logUrl()
    if (!data) return

    let img = await puppeteer.screenshot(`${data.srtempFile}gachaLog`, data)
    if (img) await this.reply(img)
  }

  /** 发送output_log.txt日志文件 */
  async logFile() {
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

    let img = await puppeteer.screenshot(`${data.srtempFile}gachaLog`, data)
    if (img) await this.reply(img)
  }

  /** #抽卡记录 */
  async getLog() {
    this.e.isAll = !!(this.e.msg.includes('全部'))
    let data = await new GachaLog(this.e).getLogData()
    if (!data) return
    let name = `${data.srtempFile}gachaLog`
    if (this.e.isAll) {
      name = `${data.srtempFile}gachaAllLog`
    }
    let img = await puppeteer.screenshot(name, data)
    if (img) await this.reply(img)
  }

  /** 导出记录 */
  async exportLog() {
    if (this.e.isGroup) {
      await this.reply('请私聊导出', false, { at: true })
      return
    }

    let exportLog = new ExportLog(this.e)

    if (this.e.msg.includes('json')) {
      return await exportLog.exportJson()
    } else {
      return await exportLog.exportXlsx()
    }
  }

  async logXlsx() {
    if (!this.e.isPrivate) {
      await this.e.reply('请私聊发送日志文件', false, { at: true })
      return true
    }

    const gsTips = `注：不支持https://github.com/biuuu/genshin-wish-export项目导出的excel文件,如果是该项目的文件请发送任意消息，取消excel导入后，使用【#json导入记录】`;
    const srTips = `注:适配https://github.com/biuuu/star-rail-warp-export项目导出的excel文件`;

    await this.e.reply(`请发送xlsx文件，该文件需要以${this.e?.isSr ? '*' : '#'}的uid命名，如：100000000.xlsx\n否则可能无法正确识别，如果误触可发送任意消息取消导入\n${this.e?.isSr ? srTips : gsTips}`);
    this.setContext('importLogXlsx');
  }

  async importLogXlsx() {
    if (!this.e.file) {
      await this.e.reply(`未检测到excel文件，操作已取消，请重新发送【${this.e?.isSr ? '*' : '#'}excel导入记录】`);
    }
    else {
      this.e.isSr = this.getContext()?.importLogXlsx.isSr;
      await new ExportLog(this.e).logXlsx();
    }
    this.finish('importLogXlsx');
  }

  async logJson() {
    if (!this.e.isPrivate) {
      await this.e.reply('请私聊发送日志文件', false, { at: true })
      return true
    }

    const gsTips = `注：适配https://github.com/biuuu/genshin-wish-export项目导出的json文件`;
    const srTips = `注:适配https://github.com/biuuu/star-rail-warp-export项目导出的json文件`;

    await this.e.reply(`请发送json文件，该文件需要以${this.e?.isSr ? '*' : '#'}的uid命名\n如：100000000.json，否则可能无法正确识别，如果误触可发送任意消息取消导入\n${this.e?.isSr ? srTips : gsTips}`);
    this.setContext('importLogJson');
  }

  async importLogJson() {
    this.e.isSr = this.getContext()?.importLogJson.isSr;
    if (!this.e.file) {
      await this.e.reply(`未检测到json文件，操作已取消，请重新发送【${this.e?.isSr ? '*' : '#'}json导入记录】`);
    }
    else {
      await new ExportLog(this.e).logJson();
    }
    this.finish('importLogJson');
  }

  async help() {
    await this.e.reply(segment.image(`file://${_path}/resources/logHelp/记录帮助.png`))
  }

  async helpPort() {
    let msg = this.e.msg.replace(/#|帮助/g, '')

    if (['电脑', 'pc'].includes(msg)) {
      await this.e.reply(segment.image(`file://${_path}/resources/logHelp/记录帮助-电脑.png`))
    } else if (['安卓'].includes(msg)) {
      await this.e.reply(`安卓抽卡记录获取教程：${this.androidUrl}`)
    } else if (['苹果', 'ios'].includes(msg)) {
      await this.e.reply(segment.image(`file://${_path}/resources/logHelp/记录帮助-苹果.png`))
    }
  }

  async logCount() {
    let data = await new LogCount(this.e).count()
    if (!data) return
    let img = await puppeteer.screenshot(`${data.srtempFile}logCount`, data)
    if (img) await this.reply(img)
  }
}
