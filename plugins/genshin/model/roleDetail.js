import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import fs from 'node:fs'
import fetch from 'node-fetch'
import common from '../../../lib/common/common.js'

export default class RoleDetail extends base {
  constructor (e) {
    super(e)
    this.model = 'roleDetail'

    this.path = './data/roleDetail/'
  }

  static async get (e) {
    if (!e.roleName) return false
    let roleDetail = new RoleDetail(e)
    return await roleDetail.getDetail()
  }

  async getDetail () {
    let character = await MysInfo.get(this.e, 'character')
    let detail = await MysInfo.get(this.e, 'detail', { avatar_id: this.e.roleId })

    if (!character || character.retcode !== 0) return false

    let avatar = await this.getAvatar(character.data)
    if (!avatar) return false

    /** 获取技能等级 */
    let skill = {}
    if (detail && detail.data) {
      skill = this.getSkill(detail.data, avatar)
    }

    if (!await this.checkImg(avatar.name)) return false

    /** 截图数据 */
    let data = {
      quality: 80,
      ...this.screenData,
      uid: this.e.uid,
      saveId: this.e.uid,
      ...avatar,
      skill
    }

    this.e.msg += ` ${avatar.name}`
    return data
  }

  async getAvatar (data) {
    let avatars = lodash.keyBy(data.avatars, 'id')

    /** 旅行者特殊处理 */
    if (this.e.roleId == '20000000') {
      if (avatars['10000007']) this.e.roleId = '10000007'
      if (avatars['10000005']) this.e.roleId = '10000005'
    }

    if (!avatars[this.e.roleId]) {
      await this.noAvatar()
      return false
    }

    /** 角色数据 */
    avatars = avatars[this.e.roleId]
    let list = []
    let set = {}
    let setArr = []
    let text1 = ''
    let text2 = ''
    let bg = 2

    list[0] = {
      type: 'weapon',
      name: avatars.weapon.name,
      showName: gsCfg.shortName(avatars.weapon.name, true),
      level: avatars.weapon.level,
      affix_level: avatars.weapon.affix_level
    }

    for (let val of avatars.reliquaries) {
      if (set[val.set.name]) {
        set[val.set.name]++

        if (set[val.set.name] == 2) {
          if (text1) {
            text2 = '2件套：' + val.set.affixes[0].effect
          } else {
            text1 = '2件套：' + val.set.affixes[0].effect
          }
        }

        if (set[val.set.name] == 4) {
          text2 = '4件套：' + val.set.name
        }
      } else {
        set[val.set.name] = 1
      }

      list.push({
        type: 'reliquaries',
        name: val.name,
        level: val.level
      })
    }

    for (let val of Object.keys(set)) {
      setArr.push({
        name: val,
        num: set[val],
        showName: gsCfg.shortName(val, true)
      })
    }

    if (avatars.reliquaries.length >= 2 && !text1) {
      text1 = '无套装效果'
    }

    if (avatars.id == '10000005') avatars.name = '空'
    if (avatars.id == '10000007') avatars.name = '荧'

    // 皮肤图片
    if (['魈', '甘雨'].includes(avatars.name)) {
      if (lodash.random(0, 100) > 50) {
        bg = 3
      }
    } else if (['芭芭拉', '凝光', '刻晴', '琴', '菲谢尔', '迪卢克', '丽莎', '神里绫华'].includes(avatars.name)) {
      if (avatars.costumes && avatars.costumes.length >= 1) {
        bg = 3
      }
    }

    return {
      name: avatars.name,
      showName: gsCfg.shortName(avatars.name),
      level: avatars.level,
      fetter: avatars.fetter,
      actived_constellation_num: avatars.actived_constellation_num,
      list,
      text1,
      text2,
      bg,
      set: setArr,
      constellations: avatars.constellations
    }
  }

  async noAvatar () {
    let msg = ''
    if (this.isBing) {
      let randFace = lodash.sample([26, 111, 110, 173, 177, 36, 37, 5, 9, 267, 264, 262, 265])
      msg = [`\n尚未拥有${this.e.roleName}`, segment.face(randFace)]
    } else {
      msg = '\n请先在米游社展示该角色'
    }
    await this.e.reply(msg, false, { at: true })
  }

  getSkill (data = {}, avatar) {
    // if (!this.isBing) return {}

    let skill = {
      id: avatar.id
    }

    let type = 'id'
    if ([10000021].includes(Number(avatar.id))) {
      type = 'group_id'
    }
    let skillList = lodash.orderBy(data.skill_list, [type], ['asc'])

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

  async checkImg (name) {
    if (fs.existsSync(`${this.path}${name}1.png`)) return true

    let ret = await this.getData()
    if (!ret) return false
    if (ret.retcode != 0) return false

    let img = {}
    for (let post of ret.data.posts) {
      img[post.post.subject] = post.post.images
    }
    if (!img[name]) {
      this.e.reply(`暂无${name}素材`)
      return false
    }

    await this.downImg(name, img[name])

    return true
  }

  async getData () {
    let url = 'https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&collection_id=1057503'

    try {
      let ret = await fetch(url, { method: 'get' })
      if (!ret.ok) {
        return false
      }
      return await ret.json()
    } catch (error) {
      return false
    }
  }

  async downImg (name, arr) {
    let ret = []
    arr.forEach((v, k) => ret.push(common.downFile(v, `${this.path}${name}${++k}.png`)))

    try {
      ret = await Promise.all(ret)
      return true
    } catch (error) {
      logger.error(`${this.e.logFnc} ${error}}`)
      return false
    }
  }
}
