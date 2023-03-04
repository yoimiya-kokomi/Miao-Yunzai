import plugin from '../../../lib/plugins/plugin.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import Today from '../model/today.js'

export class todayMaterial extends plugin {
  constructor () {
    super({
      name: '今日素材',
      dsc: '#今日素材 #每日素材',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#(今日|今天|每日|我的)*(素材|材料|天赋)[ |0-9]*$',
          fnc: 'today'
        }
      ]
    })
  }

  /** #今日素材 */
  async today () {
    let data = await new Today(this.e).getData()
    if (!data) return
    /** 生成图片 */
    let img = await puppeteer.screenshot('todayMaterial', data)
    if (img) await this.reply(img)
  }
}
