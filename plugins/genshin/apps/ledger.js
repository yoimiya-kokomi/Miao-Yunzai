import plugin from '../../../lib/plugins/plugin.js'
import Ledger from '../model/ledger.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'node:fs'

export class ledger extends plugin {
  constructor() {
    super({
      name: '札记查询',
      dsc: '米游社札记·开拓月历查询',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '^(#原石|#*札记|#*(星铁)?星琼)([0-9]|[一二两三四五六七八九十]+)*月*$',
          fnc: 'ledger'
        },
        {
          reg: '^#(原石|(星铁)?星琼)任务$',
          permission: 'master',
          fnc: 'ledgerTask'
        },
        {
          reg: '^#*(原石|札记|(星铁)?星琼)统计$',
          fnc: 'ledgerCount'
        },
        {
          reg: '^#*(去年|今年|\\d{4}年)(原石|札记|(星铁)?星琼)统计$',
          fnc: 'ledgerCountHistory'
        }
      ]
    })
  }

  async init() {
    let file = ['./data/NoteData', './data/SR_NoteData']
    for (let i of file) {
      if (!fs.existsSync(i)) {
        fs.mkdirSync(i)
      }
    }
  }

  /** #原石札记 */
  async ledger() {
    let data = await new Ledger(this.e).get()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot(`${data.srtempFile}ledger`, data)
    if (img) await this.reply(img)
  }

  /** 原石任务 */
  async ledgerTask() {
    let ledger = new Ledger(this.e)
    await ledger.ledgerTask(!!this?.e?.msg)
  }

  async ledgerCount() {
    let data = await new Ledger(this.e).ledgerCount()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot(`${data.srtempFile}ledgerCount`, data)
    if (img) await this.reply(img)
  }

  async ledgerCountHistory() {
    let data = await new Ledger(this.e).ledgerCountHistory()
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot(`${data.srtempFile}ledgerCount`, data)
    if (img) await this.reply(img)
  }
}
