import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'

export default class RoleBag extends base {
  constructor (e) {
    super(e)
    this.model = 'roleBag'
  }

  static async get (e) {
    let roleBag = new RoleBag(e)
    return await roleBag.getData()
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
    let type = 'all'
    if (avatars.length > 8) {
      if (/(.*)(四星|4星)(.*)/.test(this.e.msg)) {
        type = 4
      }
      if (/(.*)(五星|5星)(.*)/.test(this.e.msg)) {
        type = 5
      }
    }

    let costumes = gsCfg.getdefSet('role', 'other').costumes
    let sortName = gsCfg.getdefSet('role', 'other').sortName

    let list = []

    for (let val of avatars) {
      let rarity = val.rarity
      if (val.rarity > 5) {
        rarity = 5
      }

      if (type != 'all' && rarity != type) {
        continue
      }

      val.sort = rarity * 100000 + val.actived_constellation_num * 10000 + val.level * 100 + (val.id - 10000000)

      // 增加神里排序
      if (val.id == 10000002) {
        val.sort += 50
      }

      if (val.rarity > 5) {
        val.sort = val.sort - (val.id - 10000000)
      }
      val.sortLevel = val.level

      val.weapon.showName = sortName[val.weapon.name] ?? val.weapon.name

      val.name = gsCfg.roleIdToName(val.id)

      if (val.id == 10000005 || val.id == 10000007) {
        val.sort = 0
      }

      val.costumesLogo = ''
      if (val.costumes && val.costumes.length >= 1) {
        for (let v of val.costumes) {
          if (costumes.includes(v.name)) {
            val.costumesLogo = 2
            break
          }
        }
      }

      list.push(val)
    }

    list = lodash.chain(list).orderBy(['sortLevel'], ['desc']).orderBy(['sort'], ['desc']).value()

    let num = list.length

    return { list, num }
  }
}
