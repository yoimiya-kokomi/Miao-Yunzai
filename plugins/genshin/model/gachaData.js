import base from './base.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import moment from 'moment'
import fetch from 'node-fetch'
import { Character, Weapon } from '#miao.models'

export default class GachaData extends base {
  /**
   * @param e icqq 消息e
   * @param e.user_id 用户id
   */
  constructor (e) {
    super(e)
    this.model = 'gacha'
    /** 卡池 */
    this.pool = {}
    /** 默认设置 */
    this.def = gsCfg.getdefSet('gacha', 'gacha')
    this.set = gsCfg.getGachaSet(this.e.group_id)

    /** 角色武器类型 */
    this.ele = gsCfg.element
    /** 默认角色池 */
    this.type = 'role'
    /** 抽卡结果 */
    this.res = []

    this.fiveHave = []
    this.fourHave = []
  }

  static async init (e) {
    let gacha = new GachaData(e)
    /** 抽卡类型 */
    gacha.getTpye()
    /** 用户抽卡数据 */
    await gacha.userData()
    /** 卡池 */
    await gacha.getPool()

    return gacha
  }

  static getImg (name, type = 'role') {
    if (type === 'role' || type === '角色') {
      let char = Character.get(name)
      return char?.imgs?.gacha || ''
    } else if (type === 'weapon' || type === '武器') {
      let weapon = Weapon.get(name)
      return weapon?.imgs?.gacha || ''
    }
  }

  /** 抽卡 */
  async run () {
    let list = this.lottery()

    /** 截图数据 */
    let data = {
      name: this.e.sender.card,
      quality: 80,
      ...this.screenData,
      ...this.lotteryInfo(),
      list
    }

    return data
  }

  get key () {
    /** 群，私聊分开 */
    if (this.e.isGroup) {
      return `${this.prefix}${this.e.group_id}:${this.userId}`
    } else {
      return `${this.prefix}private:${this.userId}`
    }
  }

  getTpye () {
    if (this.e.msg.includes('2')) this.role2 = true
    if (this.e.msg.includes('武器')) this.type = 'weapon'
    if (this.e.msg.includes('常驻')) this.type = 'permanent'
  }

  /** 奖池数据 */
  async getPool () {
    let poolArr = gsCfg.getdefSet('gacha', 'pool')
    poolArr = [...poolArr].reverse()
    /** 获取设置卡池 */
    let NowPool = poolArr.find((val) => new Date().getTime() <= new Date(val.endTime).getTime()) || poolArr.pop()
    this.NowPool = NowPool

    if (this.type == 'weapon') {
      let weapon4 = lodash.difference(this.def.weapon4, NowPool.weapon4)
      let weapon5 = lodash.difference(this.def.weapon5, NowPool.weapon5)

      this.pool = {
        up4: NowPool.weapon4,
        role4: this.def.role4,
        weapon4,
        up5: NowPool.weapon5,
        five: weapon5
      }
    }

    if (this.type == 'role') {
      let role4 = lodash.difference(this.def.role4, NowPool.up4)
      let role5 = lodash.difference(this.def.role5, NowPool.up5)

      let up5 = NowPool.up5
      if (this.role2) up5 = NowPool.up5_2

      this.pool = {
        /** up卡池 */
        up4: NowPool.up4,
        /** 常驻四星 */
        role4,
        /** 常驻四星武器 */
        weapon4: this.def.weapon4,
        /** 五星 */
        up5,
        /** 常驻五星 */
        five: role5
      }
    }

    if (this.type == 'permanent') {
      this.pool = {
        up4: [],
        role4: this.def.role4,
        weapon4: this.def.weapon4,
        up5: [],
        five: this.def.role5,
        fiveW: this.def.weapon5
      }
    }

    this.pool.weapon3 = this.def.weapon3
  }

  /** 用户数据 */
  async userData () {
    if (this.user) return this.user

    let user = await redis.get(this.key)

    if (user) {
      user = JSON.parse(user)
      /** 重置今日数据 */
      if (this.getNow() > user.today.expire) {
        user.today = { star: [], expire: this.getEnd().end4, num: 0, weaponNum: 0 }
      }
      /** 重置本周数据 */
      if (this.getNow() > user.week.expire) {
        user.week = { num: 0, expire: this.getWeekEnd() }
      }
    } else {
      let commom = { num4: 0, isUp4: 0, num5: 0, isUp5: 0 }
      user = {
        permanent: commom,
        role: commom,
        weapon: {
          ...commom,
          /** 命定值 */
          lifeNum: 0,
          /** 定轨 0-取消 1-武器1 2-武器2 */
          type: 1
        },
        today: { star: [], expire: this.getEnd().end4, num: 0, weaponNum: 0 },
        week: { num: 0, expire: this.getWeekEnd() }
      }
    }

    this.user = user

    return user
  }

  /**
   * 抽奖
   */
  lottery (save = true) {
    /** 十连抽 */
    for (let i = 1; i <= 10; i++) {
      this.index = i

      if (this.type == 'weapon') {
        this.user.today.weaponNum++
      } else {
        this.user.today.num++
      }

      if (this.lottery5()) continue

      if (this.lottery4()) continue

      this.lottery3()
    }

    if (save) this.saveUser()

    /** 排序 星级，角色，武器 */
    this.res = lodash.orderBy(this.res, ['star', 'type', 'have', 'index'], ['desc', 'asc', 'asc', 'asc'])

    return this.res
  }

  lottery5 () {
    /** 是否大保底 */
    let isBigUP = false
    let isBing = false
    let tmpChance5 = this.probability()
    let type = this.type
    /** 没有抽中五星 */
    if (lodash.random(1, 10000) > tmpChance5) {
      /** 五星保底数+1 */
      this.user[this.type].num5++
      return false
    }

    let nowCardNum = this.user[this.type].num5 + 1

    /** 五星保底清零 */
    this.user[this.type].num5 = 0
    /** 四星保底数+1 */
    this.user[this.type].num4++

    let tmpUp = this.def.wai

    /** 已经小保底 */
    if (this.user[this.type].isUp5 == 1) {
      tmpUp = 101
    }

    if (this.type == 'permanent') tmpUp = 0

    let tmpName = ''
    if (this.type == 'weapon' && this.user[this.type].lifeNum >= 2) {
      /** 定轨 */
      tmpName = this.getBingWeapon()
      this.user[this.type].lifeNum = 0
      isBing = true
    } else if (lodash.random(1, 100) <= tmpUp) {
      /** 当祈愿获取到5星角色时，有50%的概率为本期UP角色 */
      if (this.user[this.type].isUp5 == 1) isBigUP = true
      /** 大保底清零 */
      this.user[this.type].isUp5 = 0
      /** 抽取up */
      tmpName = lodash.sample(this.pool.up5)

      /** 定轨清零 */
      if (tmpName == this.getBingWeapon()) {
        this.user[this.type].lifeNum = 0
      }
    } else {
      if (this.type == 'permanent') {
        if (lodash.random(1, 100) <= 50) {
          tmpName = lodash.sample(this.pool.five)
          type = 'role'
        } else {
          tmpName = lodash.sample(this.pool.fiveW)
          type = 'weapon'
        }
      } else {
        /** 歪了 大保底+1 */
        this.user[this.type].isUp5 = 1
        tmpName = lodash.sample(this.pool.five)
      }
    }

    /** 命定值++ */
    if (tmpName != this.getBingWeapon()) {
      this.user[this.type].lifeNum++
    }

    /** 记录今天五星 */
    this.user.today.star.push({ name: tmpName, num: nowCardNum })
    /** 本周五星数 */
    this.user.week.num++

    let have = false
    /** 重复抽中转换星辉 */
    if (this.fiveHave.includes(tmpName)) {
      have = true
    } else {
      this.fiveHave.push(tmpName)
    }

    this.res.push({
      name: tmpName,
      star: 5,
      type,
      num: nowCardNum,
      element: this.ele[tmpName] || '',
      index: this.index,
      isBigUP,
      isBing,
      have,
      imgFile: GachaData.getImg(tmpName, type),
      rand: lodash.random(1, 7)
    })

    return true
  }

  lottery4 () {
    let tmpChance4 = this.def.chance4

    /** 四星保底 */
    if (this.user[this.type].num4 >= 9) {
      tmpChance4 += 10000
    } else if (this.user[this.type].num4 >= 5) {
      tmpChance4 = tmpChance4 + Math.pow(this.user[this.type].num4 - 4, 2) * 500
    }

    /** 没抽中四星 */
    if (lodash.random(1, 10000) > tmpChance4) {
      /** 四星保底数+1 */
      this.user[this.type].num4++
      return false
    }

    /** 保底四星数清零 */
    this.user[this.type].num4 = 0

    /** 四星保底 */
    let tmpUp = 50
    if (this.type == 'weapon') tmpUp = 75

    if (this.user[this.type].isUp4 == 1) {
      this.user[this.type].isUp4 = 0
      tmpUp = 100
    }

    if (this.type == 'permanent') tmpUp = 0

    let type = 'role'
    let tmpName = ''
    /** 当祈愿获取到4星物品时，有50%的概率为本期UP角色 */
    if (lodash.random(1, 100) <= tmpUp) {
      /** up 4星 */
      tmpName = lodash.sample(this.pool.up4)
      type = this.type
    } else {
      this.user[this.type].isUp4 = 1
      /** 一半概率武器 一半4星 */
      if (lodash.random(1, 100) <= 50) {
        tmpName = lodash.sample(this.pool.role4)
        type = 'role'
      } else {
        tmpName = lodash.sample(this.pool.weapon4)
        type = 'weapon'
      }
    }

    let have = false
    /** 重复抽中转换星辉 */
    if (this.fourHave.includes(tmpName)) {
      have = true
    } else {
      this.fourHave.push(tmpName)
    }

    this.res.push({
      name: tmpName,
      star: 4,
      type,
      element: this.ele[tmpName] || '',
      index: this.index,
      imgFile: GachaData.getImg(tmpName, type),
      have
    })

    return true
  }

  lottery3 () {
    /** 随机三星武器 */
    let tmpName = lodash.sample(this.pool.weapon3)
    this.res.push({
      name: tmpName,
      star: 3,
      type: 'weapon',
      element: this.ele[tmpName] || '',
      index: this.index,
      imgFile: GachaData.getImg(tmpName, 'weapon')
    })

    return true
  }

  probability () {
    let tmpChance5 = this.def.chance5

    if (this.type == 'role' || this.type == 'permanent') {
      /** 增加双黄概率 */
      if (this.user.week.num == 1) {
        tmpChance5 *= 2
      }

      /** 保底 */
      if (this.user[this.type].num5 >= 90) {
        tmpChance5 = 10000
      } else if (this.user[this.type].num5 >= 74) {
        /** 74抽之后逐渐增加概率 */
        tmpChance5 = 590 + (this.user[this.type].num5 - 74) * 530
      } else if (this.user[this.type].num5 >= 60) {
        /** 60抽之后逐渐增加概率 */
        tmpChance5 = this.def.chance5 + (this.user[this.type].num5 - 50) * 40
      }
    }

    if (this.type == 'weapon') {
      tmpChance5 = this.def.chanceW5

      /** 增加双黄概率 */
      if (this.user.week.num == 1) {
        tmpChance5 = tmpChance5 * 3
      }

      /** 80次都没中五星 */
      if (this.user[this.type].num5 >= 80) {
        tmpChance5 = 10000
      } else if (this.user[this.type].num5 >= 62) {
        /** 62抽后逐渐增加概率 */
        tmpChance5 = tmpChance5 + (this.user[this.type].num5 - 61) * 700
      } else if (this.user[this.type].num5 >= 45) {
        /** 50抽后逐渐增加概率 */
        tmpChance5 = tmpChance5 + (this.user[this.type].num5 - 45) * 60
      } else if (this.user[this.type].num5 >= 10 && this.user[this.type].num5 <= 20) {
        tmpChance5 = tmpChance5 + (this.user[this.type].num5 - 10) * 30
      }
    }

    return tmpChance5
  }

  /** 获取定轨的武器 */
  getBingWeapon (sortName = false) {
    if (this.type != 'weapon') return false

    let name = this.pool.up5[this.user[this.type].type - 1]

    if (sortName) name = gsCfg.shortName(name, true)

    return name
  }

  lotteryInfo () {
    let info = `累计「${this.user[this.type].num5}抽」`
    let nowFive = 0
    let nowFour = 0

    this.res.forEach((v, i) => {
      if (v.star == 5) {
        nowFive++
        if (v.type == 'role') {
          let char = Character.get(v.name)
          info = char?.abbr || ''
        } else {
          let weapon = Weapon.get(v.name)
          info = weapon.abbr || ''
        }
        info += `「${v.num}抽」`
        if (v.isBigUP) info += '大保底'
        if (v.isBing) info += '定轨'
      }
      if (v.star == 4) {
        nowFour++
      }
    })

    let poolName = `角色池：${gsCfg.shortName(this.pool.up5[0])}`
    if (this.type == 'permanent') poolName = '常驻池'

    let res = {
      info,
      nowFive,
      nowFour,
      poolName,
      isWeapon: this.type == 'weapon',
      bingWeapon: this.getBingWeapon(true),
      lifeNum: this.user[this.type]?.lifeNum || 0
    }

    logger.debug(`[${poolName}] [五星数：${nowFive}] [${info}] [定轨：${res.lifeNum}]`)

    return res
  }

  async saveUser () {
    this.user.today.expire = this.getEnd().end4
    await redis.setEx(this.key, 3600 * 24 * 14, JSON.stringify(this.user))
  }

  getNow () {
    return moment().format('X')
  }

  getEnd () {
    let end = moment().endOf('day').format('X')
    let end4 = 3600 * 4
    if (moment().format('k') < 4) {
      end4 += Number(moment().startOf('day').format('X'))
    } else {
      end4 += Number(end)
    }
    return { end, end4 }
  }

  getWeekEnd () {
    return Number(moment().day(7).endOf('day').format('X'))
  }
}
