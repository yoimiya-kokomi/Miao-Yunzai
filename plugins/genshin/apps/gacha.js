/** 导入plugin */
import plugin from '../../../lib/plugins/plugin.js'
import GachaData from '../model/gachaData.js'
import fs from 'node:fs'
import lodash from 'lodash'

export class gacha extends plugin {
  constructor () {
    super({
      name: '十连',
      dsc: '模拟抽卡，每天十连一次，四点更新',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#*(10|[武器池常驻]*[十]+|抽|单)[连抽卡奖][123武器池常驻]*$',
          fnc: 'gacha'
        },
        {
          reg: '(^#*定轨|^#定轨(.*))$',
          fnc: 'weaponBing'
        }
      ]
    })
  }

  /** #十连 */
  async gacha () {
    this.GachaData = await GachaData.init(this.e)

    if (this.checkLimit()) return

    let data = await this.GachaData.run()

    /** 生成图片 */
    await this.renderImg('genshin', 'html/gacha/gacha-trial', data, {
      recallMsg: data.nowFive >= 1 || data.nowFour >= 4 ? false : this.GachaData.set.delMsg
    })
  }

  /** 检查限制 */
  checkLimit () {
    /** 主人不限制 */
    if (this.e.isMaster) return false

    let { user } = this.GachaData
    let { num, weaponNum } = user.today

    let nowCount = num
    if (this.GachaData.type == 'weapon') nowCount = weaponNum

    if (this.GachaData.set.LimitSeparate == 1) {
      if (nowCount < this.GachaData.set.count * 10) return false
    } else {
      if (num + weaponNum < this.GachaData.set.count * 10) return false
    }

    let msg = lodash.truncate(this.e.sender.card, { length: 8 }) + '\n'

    if (user.today.star.length > 0) {
      msg += '今日五星：'
      if (user.today.star.length >= 4) {
        msg += `${user.today.star.length}个`
      } else {
        user.today.star.forEach(v => {
          msg += `${v.name}(${v.num})\n`
        })
        msg = lodash.trim(msg, '\n')
      }
      if (user.week.num >= 2) {
        msg += `\n本周：${user.week.num}个五星`
      }
    } else {
      msg += `今日已抽，累计${nowCount}抽无五星`
    }
    this.reply(msg, false, { recallMsg: this.GachaData.set.delMsg })
    return true
  }

  /** #定轨 */
  async weaponBing () {
    let Gacha = await GachaData.init(this.e)

    let { NowPool, user, msg = '' } = Gacha

    if (user.weapon.type >= 2) {
      user.weapon.type = 0
      user.weapon.bingWeapon = ''
      msg = '\n定轨已取消'
    } else {
      user.weapon.type++
      user.weapon.bingWeapon = NowPool.weapon5[user.weapon.type - 1]
      msg = []
      NowPool.weapon5.forEach((v, i) => {
        if (user.weapon.type - 1 == i) {
          msg.push(`[√] ${NowPool.weapon5[i]}`)
        } else {
          msg.push(`[  ] ${NowPool.weapon5[i]}`)
        }
      })
      msg = '定轨成功\n' + msg.join('\n')
    }
    /** 命定值清零 */
    user.weapon.lifeNum = 0
    Gacha.user = user
    Gacha.saveUser()

    this.reply(msg, false, { at: this.e.user_id })
  }

  /** 初始化创建配置文件 */
  async init () {
    let file = './plugins/genshin/config/gacha.set.yaml'

    if (fs.existsSync(file)) return

    fs.copyFileSync('./plugins/genshin/defSet/gacha/set.yaml', file)
  }
}
