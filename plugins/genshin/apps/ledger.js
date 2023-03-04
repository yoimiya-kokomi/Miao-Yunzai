import plugin from '../../../lib/plugins/plugin.js'
import Ledger from '../model/ledger.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'node:fs'

export class ledger extends plugin {
  constructor () {
    super({
      name: '札记查询',
      dsc: '原神体米游社札记原神查询',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '^(#原石|#*札记)([0-9]|[一二两三四五六七八九十]+)*月*$',
          fnc: 'ledger'
        },
        {
          reg: '^(#签到|#*米游社(自动)*签到)$',
          fnc: 'sign'
        },
        {
          reg: '^#原石任务$',
          permission: 'master',
          fnc: 'ledgerTask'
        },
        {
          reg: '^#*(原石|札记)统计$',
          fnc: 'ledgerCount'
        },
        {
          reg: '^#*(去年|今年|\\d{4}年)(原石|札记)统计$',
          fnc: 'ledgerCountHistory'
        }
      ]
    })

    // this.set = gsCfg.getConfig('mys', 'set')

    // /** 定时任务 */
    // this.task = {
    //   cron: this.set.signTime,
    //   name: '米游社签到任务',
    //   fnc: () => this.signTask()
    // }
  }

  async init () {
    if (!fs.existsSync('./data/NoteData')) {
      fs.mkdirSync('./data/NoteData')
    }
  }

  /** #原石札记 */
  async ledger () {
    let data = await new Ledger(this.e).get()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot('ledger', data)
    if (img) await this.reply(img)
  }

  /** 原石任务 */
  async ledgerTask () {
    let ledger = new Ledger(this.e)
    await ledger.ledgerTask(!!this?.e?.msg)
  }

  async ledgerCount () {
    let data = await new Ledger(this.e).ledgerCount()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot('ledgerCount', data)
    if (img) await this.reply(img)
  }

  async ledgerCountHistory () {
    let data = await new Ledger(this.e).ledgerCountHistory()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot('ledgerCount', data)
    if (img) await this.reply(img)
  }
}
