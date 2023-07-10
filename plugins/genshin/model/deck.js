import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import lodash from 'lodash'

export default class Deck extends base {
  constructor(e) {
    super(e)
    this.model = 'deck'

    this.headIndexStyle = `<style> .head_box { background: url(${this.screenData.pluResPath}img/roleIndex/namecard/${lodash.random(1, 8)}.png) #f5f5f5; background-position-x: 30px; background-repeat: no-repeat; border-radius: 15px; font-family: tttgbnumber; padding: 10px 20px; position: relative; background-size: auto 101%; }</style>`
  }

  async getdata(api) {
    let seed_id = lodash.sample('abcdefghijklmnopqrstuvwxyz0123456789', 16).replace(/,/g, '')
    let device_fp = await MysInfo.get(this.e, 'getFp', {
      seed_id
    })
    let res = await MysInfo.get(this.e, api, {
      headers: {
        'x-rpc-device_fp': device_fp?.data?.device_fp
      }
    })
    return res
  }

  async getIndex(id, list = false) {
    let res = await this.getdata('deckList')
    if (res?.retcode !== 0) return false

    let Data
    if (!list) {
      for (let i of res.data.deck_list) {
        if (i.id == id) Data = i
      }
      if (!Data) {
        this.e.reply(`无牌组${id}，请查看#七圣卡组列表`)
        return false
      }
    } else {
      this.model = 'deckList'
      Data = res.data.deck_list
    }

    /** 截图数据 */
    let data = {
      quality: 80,
      ...this.screenData,
      uid: this.e.uid,
      saveId: this.e.uid,
      nickname: res.data.nickname,
      level: res.data.level,
      Data,
      headIndexStyle: this.headIndexStyle
    }
    return data
  }
  async getcard(id) {
    let res = {}
    for (let api of ['basicInfo', 'avatar_cardList', 'action_cardList']) {
      if ((id == 2 && api == 'avatar_cardList') || (id == 1 && api == 'action_cardList')) continue
      res[api] = (await this.getdata(api)).data
    }
    this.model = 'deckCard'

    let data = {
      quality: 80,
      ...this.screenData,
      uid: this.e.uid,
      saveId: this.e.uid,
      ...res,
      headIndexStyle: this.headIndexStyle
    }
    return data
  }

}