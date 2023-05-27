import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import MysApi from './mys/mysApi.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import common from '../../../lib/common/common.js'

export default class RoleList extends base {
  constructor (e) {
    super(e)
    this.model = 'roleList'

    /** 缓存时间，单位分钟 */
    this.cacheCd = 30
  }

  static async get (e) {
    let roleList = new RoleList(e)
    return await roleList.getData()
  }

  async getData () {
    let res = await MysInfo.get(this.e, 'character')
    if (!res || res.retcode !== 0) return false

    let uid = this.e.uid
    let avatars = res.data.avatars
    if (avatars.length <= 0) return false

    /** 判断是否绑定了ck */
    this.ck = await MysInfo.checkUidBing(uid, this.e)

    let skill = []
    if (this.ck) {
      await this.e.reply('正在获取角色信息，请稍候...')
      this.mysApi = new MysApi(uid, this.ck.ck, { log: false })
      this.mysApi.cacheCd = 1800
      skill = await this.getAllSkill(avatars)
    }

    /** 截图数据 */
    let data = {
      ...this.screenData,
      saveId: this.e.uid,
      uid: this.e.uid,
      ...this.dealData(avatars, skill)
    }

    return data
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
      if (val.name.includes('普通攻击') || val.name.includes('Normal Attack')) {
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

  dealData (avatars, skill) {
    let daily = gsCfg.getdefSet('daily', 'daily')

    const displayMode = /(角色|武器|练度)/.test(this.e.msg) ? 'weapon' : 'talent'

    // 四星五星
    let star = 0
    let msg = this.e.msg.replace(this.e.uid, '')
    if (/(四|4)/.test(msg)) star = 4
    if (/(五|5)/.test(msg)) star = 5

    // 天赋等级背景
    const talentLvMap = '0,1,1,1,2,2,3,3,3,4,5'.split(',')

    // 根据每日素材构建 角色->素材的映射关系
    let charTalentMap = {}
    daily.forEach((weekCfg, week) => {
      lodash.forIn(weekCfg[0], (talentCfg, talentName) => {
        talentCfg[1].forEach((charName) => {
          charTalentMap[charName] = { name: talentName, week: [3, 1, 2][week] }
        })
      })
    })

    let avatarRet = []
    for (let idx in avatars) {
      let curr = avatars[idx]
      let avatar = lodash.pick(curr, 'id,name,rarity,level,rarity,fetter'.split(','))
      avatar.rarity = avatar.rarity > 5 ? 5 : avatar.rarity
      // let weapon = curr.weapon || {}
      'name,level,rarity,affix_level'.split(',').forEach((idx) => {
        avatar[`weapon_${idx}`] = curr.weapon[idx]
      })
      avatar.cons = curr.actived_constellation_num
      if (avatar.id == 10000007) {
        avatar.name = '荧'
        avatar.fetter = 10
      } else if (avatar.id == 10000005) {
        avatar.name = '空'
        avatar.fetter = 10
      } else {
        let talent = charTalentMap[avatar.name] || {}
        avatar.talent = talent.name
        avatar.talentWeek = talent.week // `${talent.week}${talent.week + 3}`;
      }

      let skillRet = skill[avatar.id] || {}
      const talentConsCfg = { a: 0, e: 3, q: 5 }

      lodash.forIn(talentConsCfg, (consLevel, key) => {
        let talent = skillRet[key] || {}
        // 天赋等级
        avatar[key] = talent.level_current || '-'
        // 是否有命座加成
        avatar[`${key}_plus`] = talent.level_current > talent.level_original
        // 天赋书星级
        avatar[`${key}_lvl`] = talentLvMap[talent.level_original * 1]
        avatar[`${key}_original`] = talent.level_original * 1
      })
      avatar.aeq = avatar.a * 1 + avatar.e + avatar.q
      avatarRet.push(avatar)
    }

    // 超过八个角色才分类四星五星
    if (star >= 4 && avatarRet.length > 8) {
      avatarRet = avatarRet.filter(item => item.rarity == star)
    }

    let sortKey = ({
      talent: 'aeq,rarity,level,star,fetter,talentWeek',
      weapon: 'level,rarity,aeq,cons,weapon_level,weapon_rarity,weapon_affix_level,fetter'
    })[displayMode].split(',')

    avatarRet = lodash.orderBy(avatarRet, sortKey, lodash.repeat('desc,', sortKey.length).split(','))

    let noTalent = avatarRet.length == 0 || /^-+$/.test(avatarRet.map((d) => d.a).join(''))

    let talentNotice = `*技能数据会缓存${this.cacheCd}分钟`
    if (noTalent) {
      talentNotice = '该uid未绑定Cookie，无法获取技能数据。回复【#体力帮助】查看教程'
    }

    let week = new Date().getDay()
    if (new Date().getHours() < 4) {
      week--
    }

    return {
      avatars: avatarRet,
      bgType: Math.ceil(Math.random() * 3),
      abbr: { ...gsCfg.getdefSet('role', 'other').sortName, ...gsCfg.getdefSet('weapon', 'other').sortName },
      displayMode,
      week: [3, 1, 2][week % 3],
      talentNotice
    }
  }
}
