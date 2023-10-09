import plugin from '../../../lib/plugins/plugin.js'
import gsCfg from '../model/gsCfg.js'
import fetch from 'node-fetch'

export class takeBirthdayPhoto extends plugin {
  constructor() {
    super({
      name: '留影叙佳期',
      dsc: '留影叙佳期',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?(留影(叙佳期)?|((领)?((角色)?生日)(卡)?))$',
          fnc: 'birthdaystar'
        }
      ]
    })
  }

  async birthdaystar(e) {
    const { user_id } = e

    const userInfo = await this.getCookie(user_id)
    if (!userInfo) {
      e.reply('请先绑定ck再使用本功能哦~', true)
      return true
    }

    const e_hk4e_token = await this.getEHK4EToken(userInfo.ck, userInfo.uid)
    if (!e_hk4e_token) {
      e.reply('获取e-hk4e_token失败，请刷新ck后再试~', true)
      return true
    }

    const birthday_star_list = await this.getBirthdayStar(userInfo.uid, e_hk4e_token, userInfo.ck)
    if (!birthday_star_list) {
      e.reply('获取生日角色失败，请稍后再试~', true)
      return true
    }

    if (birthday_star_list.length === 0) {
      e.reply('今天没有生日角色哦~', true)
      return true
    }
    try {
      for (const role of birthday_star_list) {
        await e.reply(`正在获取${role.name}的图片，请稍等~`, true)
        await e.reply(segment.image(role.take_picture))
        const message = await this.getBirthdayStarImg(userInfo.uid, e_hk4e_token, userInfo.ck, role.role_id)
        if (message != 'success') {
          await e.reply(message)
          return true
        } else {
          await e.reply(`获取${role.name}的图片成功~`, true)
        }
      }
    } catch (error) {
      await e.reply(`获取角色留影叙佳期图片失败，可能是ck失效...`, true)
      logger.error(error)
    }

    return true
  }

  async getCookie(user_id) {
    const userInfo = ((await gsCfg.getBingCk()).ckQQ)[user_id]
    return userInfo
  }

  async getEHK4EToken(ck, uid) {
    const isCN = uid.toString().match(/^[125]/) ? true : false
    const url = isCN ? 'https://api-takumi.mihoyo.com/common/badge/v1/login/account' : 'https://api-os-takumi.mihoyo.com/common/badge/v1/login/account'
    const game_biz = isCN ? 'hk4e_cn' : 'hk4e_global'
    const region = await this.getServer(uid)
    const headers = {
      'Cookie': ck,
      'Content-Type': 'application/json;charset=UTF-8',
      'Referer': 'https://webstatic.mihoyo.com/',
      'Origin': 'https://webstatic.mihoyo.com'
    }
    const body = JSON.stringify({
      uid: Number(uid),
      game_biz: game_biz,
      lang: 'zh-cn',
      region: region
    })
    let res = await fetch(url, { method: "POST", body, headers })
    const e_hk4e_token = res.headers.get('set-cookie').match(/e_hk4e_token=(.*?);/)[1]
    res = await res.json()
    if (res.retcode != 0) {
      return false
    }
    return e_hk4e_token
  }

  async getServer(uid) {
    switch (String(uid)[0]) {
      case '1':
      case '2':
        return 'cn_gf01'
      case '5':
        return 'cn_qd01'
      case '6':
        return 'os_usa'
      case '7':
        return 'os_euro'
      case '8':
        return 'os_asia'
      case '9':
        return 'os_cht'
    }
    return 'cn_gf01'
  }

  async getBirthdayStar(uid, e_hk4e_token, ck) {
    const cookie = `e_hk4e_token=${e_hk4e_token};${ck}`
    const badge_region = await this.getServer(uid)
    const isCN = uid.toString().match(/^[125]/) ? true : false
    const game_biz = isCN ? 'hk4e_cn' : 'hk4e_global'
    const headers = { 'Cookie': cookie }
    const url = `https://hk4e-api.mihoyo.com/event/birthdaystar/account/index?lang=zh-cn&badge_uid=${uid}&badge_region=${badge_region}&game_biz=${game_biz}&activity_id=20220301153521`
    let res = await fetch(url, { headers })
    res = await res.json()
    return res.data.role
  }

  async getBirthdayStarImg(uid, e_hk4e_token, ck, role_id) {
    const cookie = `e_hk4e_token=${e_hk4e_token};${ck}`
    const badge_region = await this.getServer(uid)
    const isCN = uid.toString().match(/^[125]/) ? true : false
    const game_biz = isCN ? 'hk4e_cn' : 'hk4e_global'
    const headers = { 'Cookie': cookie }
    const url = `https://hk4e-api.mihoyo.com/event/birthdaystar/account/post_my_draw?lang=zh-cn&badge_uid=${uid}&badge_region=${badge_region}&game_biz=${game_biz}&activity_id=20220301153521`
    const body = JSON.stringify({ role_id: Number(role_id) })
    let res = await fetch(url, { method: "POST", body, headers })
    res = await res.json()
    if (res.retcode != 0) {
      return res.message
    } else {
      return 'success'
    }
  }
}