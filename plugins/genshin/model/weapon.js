import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'

export default class Weapon extends base {
  constructor (e) {
    super(e)
    this.model = 'weapon'
  }

  static async get (e) {
    let weapon = new Weapon(e)
    return await weapon.getData()
  }

  /** #武器 */
  async getData (e) {
    let res = await MysInfo.get(this.e, 'character')

    if (!res || res.retcode !== 0) return false

    let avatars = res.data.avatars

    if (avatars.length <= 0) {
      return true
    }

    /** 截图数据 */
    let data = {
      ...this.screenData,
      saveId: this.e.uid,
      uid: this.e.uid,
      ...this.dealData(avatars)
    }

    return data
  }

  dealData (avatars) {
    let actWeapon = gsCfg.getdefSet('weapon', 'other').actWeapon
    let sortName = gsCfg.getdefSet('weapon', 'other').sortName

    let weapon = []
    let count = {
      five: 0,
      four: 0,
      three: 0,
      单手剑: 0,
      双手剑: 0,
      长柄武器: 0,
      弓: 0,
      法器: 0
    }

    for (let val of avatars) {
      if (val.weapon.rarity <= 1) {
        continue
      }
      val.name = gsCfg.roleIdToName(val.id)

      if (val.rarity > 5) {
        val.rarity = 5
      }

      if (val.weapon.rarity == 5) count.five++
      if (val.weapon.rarity == 4) count.four++
      if (val.weapon.rarity == 3) count.three++

      count[val.weapon.type_name]++

      let firstSort = 0
      firstSort += val.weapon.level
      firstSort += (val.weapon.rarity - 4) * 20
      if (val.weapon.level >= 20) {
        firstSort += val.level
      }
      if (!actWeapon.includes(val.weapon.name)) {
        firstSort += val.weapon.affix_level * 5
      }

      let sort = 0
      sort += val.weapon.rarity * 1000000
      sort += val.weapon.affix_level * 100000
      sort += val.weapon.level * 1000
      sort += val.rarity * 100
      sort += val.level

      weapon.push({
        role_name: val.name,
        role_level: val.level,
        role_rarity: val.rarity,
        name: val.weapon.name,
        showName: sortName[val.weapon.name] ?? val.weapon.name,
        rarity: val.weapon.rarity,
        level: val.weapon.level,
        affix_level: val.weapon.affix_level,
        firstSort,
        sort
      })
    }

    // 重新排序
    weapon = lodash.chain(weapon).orderBy(['firstSort'], ['desc']).orderBy(['sort'], ['desc']).value()

    return { list: weapon, count }
  }
}
