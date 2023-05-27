import moment from 'moment'
import lodash from 'lodash'
import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import MysApi from './mys/mysApi.js'
import gsCfg from './gsCfg.js'
import common from '../../../lib/common/common.js'

export default class Today extends base {
  constructor (e) {
    super(e)
    this.model = 'todayMaterial'
  }

  async getData () {
    if (moment().day() == 0 && moment().hour() > 4) {
      this.e.reply('今天周日，全部素材都可以刷哦~')
      return false
    }

    let res = await MysInfo.get(this.e, 'character')
    if (!res || res.retcode !== 0) return false

    let avatars = res.data.avatars

    return await this.todayData(avatars)
  }

  async todayData (avatars) {
    let daily = gsCfg.getdefSet('daily', 'daily')
    let other = gsCfg.getdefSet('weapon', 'other')
    // 除周日日期余三
    let week = Number(moment().day()) || 7

    // 4点后再展示第二日
    if (moment().hour() < 4) {
      week--
    }

    // 今天素材
    let nowElement = daily[week % 3]

    let mainList = []
    let count = 0
    let role = []
    /* eslint-disable no-labels */
    a:
    for (let i in nowElement) {
      lodash.forEach(nowElement[i], (ele, name) => {
        let temp = {
          name,
          area: ele[0],
          // 区分武器和天赋类型
          isTalent: i == 0,
          list: []
        }

        // 获取角色数组
        let element = ele[1]

        b:
        for (let val of avatars) {
        // 进行天赋的数据处理
          if ((temp.isTalent) && (element.indexOf(val.name) != -1)) {
            role.push(val)
            let rarity = val.rarity
            if (val.rarity > 5) {
              rarity = 5
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

            if (val.id == 10000005) {
              val.name = '空'
              val.sort = 0
            }
            if (val.id == 10000007) {
              val.name = '荧'
              val.sort = 0
            }

            temp.list.push(val)
          } else if ((!temp.isTalent) && (element.indexOf(val.weapon.name) != -1)) {
            if (val.weapon.level >= 90) continue b
            // 进行武器的数据处理
            let firstSort = 0
            firstSort += val.weapon.level
            firstSort += (val.weapon.rarity - 4) * 20
            if (val.weapon.level >= 20) {
              firstSort += val.level
            }
            if (!other.actWeapon.includes(val.weapon.name)) {
              firstSort += val.weapon.affix_level * 5
            }

            if (val.id == 10000005) {
              val.name = '空'
            }
            if (val.id == 10000007) {
              val.name = '荧'
            }

            let sort = 0
            sort += val.weapon.rarity * 1000000
            sort += val.weapon.affix_level * 100000
            sort += val.weapon.level * 1000
            sort += val.rarity * 100
            sort += val.level

            temp.list.push({
              role_name: val.name,
              role_level: val.level,
              role_rarity: val.rarity,
              name: val.weapon.name,
              // showName: genshin.abbr[val.weapon.name] ? genshin.abbr[val.weapon.name] : val.weapon.name,
              rarity: val.weapon.rarity,
              level: val.weapon.level,
              affix_level: val.weapon.affix_level,
              firstSort,
              sort
            })
          }
        }

        // 重新排序
        if (temp.isTalent == 1) {
          temp.list = lodash.chain(temp.list).orderBy(['sortLevel'], ['desc']).orderBy(['sort'], ['desc']).value()
        } else {
          temp.list = lodash.chain(temp.list).orderBy(['firstSort'], ['desc']).orderBy(['sort'], ['desc']).value()
        }

        count++
        mainList.push(temp)
      })
    }

    /** 判断是否绑定了ck */
    this.ck = await MysInfo.checkUidBing(this.e.uid, this.e)

    let skill = {}
    if (this.ck) {
      this.mysApi = new MysApi(this.e.uid, this.ck.ck, { log: false })
      this.mysApi.cacheCd = 1800
      skill = await this.getAllSkill(role)
    }

    let day = moment().format('MM-DD hh:mm')
    let weekData = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    day += ' ' + weekData[moment().day()]

    // let num = mainList.length;
    let num = count

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      day,
      num,
      mainList,
      skill,
      ...this.screenData
    }
  }

  async getAllSkill (avatars) {
    let skillRet = []; let skill = []
    // 批量获取技能数据，分组10个id一次，延迟100ms
    let num = 10; let ms = 100
    let avatarArr = lodash.chunk(avatars, num)

    let start = Date.now()

    for (let val of avatarArr) {
      for (let avatar of val) {
        skillRet.push(this.getSkill(avatar))
      }
      skillRet = await Promise.all(skillRet)

      // 过滤没有获取成功的
      skillRet.filter(item => item.a)
      skillRet = skillRet.filter(item => item.a)

      await common.sleep(ms)
    }
    skill = lodash.keyBy(skillRet, 'id')
    logger.mark(`[米游社接口][detail][${this.ck.uid}] ${Date.now() - start}ms`)
    return skill
  }

  async getSkill (avatar) {
    let force = !this.e.msg.includes('force')
    let res = await this.mysApi.getData('detail', { avatar_id: avatar.id }, force)
    if (!res || res.retcode !== 0 || !res.data.skill_list) return false

    let skill = {
      id: avatar.id
    }

    let type = 'id'
    if ([10000021].includes(Number(avatar.id))) {
      type = 'group_id'
    }

    let skillList = lodash.orderBy(res.data.skill_list, [type], ['asc'])

    for (let val of skillList) {
      val.level_original = val.level_current
      if (val.name.includes('普通攻击')) {
        skill.a = val
        continue
      }
      if (val.max_level >= 10 && !skill.e) {
        skill.e = val
        continue
      }
      if (val.max_level >= 10 && !skill.q) {
        skill.q = val
        continue
      }
    }
    if (avatar.actived_constellation_num >= 3) {
      if (avatar.constellations[2].effect.includes(skill.e.name)) {
        skill.e.level_current += 3
      } else if (avatar.constellations[2].effect.includes(skill.q.name)) {
        skill.q.level_current += 3
      }
    }
    if (avatar.actived_constellation_num >= 5) {
      if (avatar.constellations[4].effect.includes(skill.e.name)) {
        skill.e.level_current += 3
      } else if (avatar.constellations[4].effect.includes(skill.q.name)) {
        skill.q.level_current += 3
      }
    }

    return skill
  }
}
