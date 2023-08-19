import plugin from '../../../lib/plugins/plugin.js'
import Note from '../model/note.js'
import gsCfg from '../model/gsCfg.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

gsCfg.cpCfg('mys', 'set')

export class dailyNote extends plugin {
  constructor() {
    super({
      name: '体力查询',
      dsc: '体力查询',
      event: 'message',
      priority: 300,
      rule: [{
        reg: '^#*(原神|星铁)?(体力|树脂|查询体力)$',
        fnc: 'note'
      }]
    })

    this.set = gsCfg.getConfig('mys', 'set')
  }

  /** #体力 */
  async note() {
    let data = await Note.get(this.e)
    if (!data) return

    /** 生成图片 */
    let img = await puppeteer.screenshot(`${data.srtempFile}dailyNote`, data)
    if (img) await this.reply(img)
  }


}
