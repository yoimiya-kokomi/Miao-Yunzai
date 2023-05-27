import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import MysApi from './mys/mysApi.js'
import lodash from 'lodash'
import gsCfg from './gsCfg.js'

export default class Calculator extends base {
  constructor (e) {
    super(e)
    this.model = 'calculator'
    this.checkMsg = '设置角色、武器、技能等级有误\n指令：#刻晴养成\n示例：#刻晴养成81 90 9 9 9\n参数为角色、武器、技能等级'
  }

  async get (role) {
    this.role = role
    /** 获取绑定uid */
    let uid = await MysInfo.getUid(this.e)
    if (!uid) return false

    /** 判断是否绑定了ck */
    let ck = await MysInfo.checkUidBing(uid, this.e)
    if (!ck) {
      await this.e.reply(MysInfo.tips)
      return false
    }

    this.mysApi = new MysApi(uid, ck.ck, { log: true })

    /** 获取角色数据 */
    let character = await this.mysApi.getData('character')
    if (!character || character.retcode !== 0) return false
    character = character.data

    /** 获取设置参数 */
    await this.getSet()

    /** 获取计算角色 */
    this.dataCharacter = character.avatars.find((item) => item.id == role.roleId)

    /** 获取计算参数 */
    let body = await this.getBody()
    if (!body) return false

    /** 计算 */
    let computes = await this.computes(body)
    if (!computes) return false

    return {
      saveId: uid,
      uid,
      dataCharacter: this.dataCharacter,
      setSkill: this.setSkill,
      skillList: this.skillList,
      computes,
      ...this.screenData
    }
  }

  async getSet () {
    let defSetSkill = '90,90,10,10,10'.split(',')

    let set = this.e.msg.replace(/#|＃|养成|计算/g, '').trim()

    set = set.replace(/，| /g, ',')

    set = set.replace(this.role.alias, '')

    let setSkill = []
    if (set) {
      setSkill = set.split(',')
      setSkill = lodash.compact(setSkill)
      for (let i = 0; i <= 4; i++) {
        if (!setSkill[i]) setSkill[i] = defSetSkill[i]
      }
    } else {
      setSkill = defSetSkill
    }

    if (setSkill.length != 5) {
      let reMsg = this.checkMsg.replace(/刻晴/g, this.role.alias)
      await this.e.reply(reMsg)
      return false
    }

    /** 检查参数 */
    let check = [90, 90, 10, 10, 10]
    for (const key in check) {
      if (check[key] < Number(setSkill[key])) {
        setSkill[key] = check[key]
      }
    }

    this.setSkill = setSkill
  }

  async getBody () {
    // 技能
    let skillList = []
    if (this.dataCharacter) {
      /** 角色存在获取技能数据 */
      let detail = await this.mysApi.getData('detail', { avatar_id: this.role.roleId })
      if (!detail || detail.retcode !== 0) return false

      skillList = detail.data.skill_list
    } else {
      /** 尚未拥有的角色 */
      skillList = await this.getSkillId(this.role.roleId)

      if (!skillList) {
        this.e.reply('暂无角色数据,请稍后再试')
        return false
      }

      let four = gsCfg.getdefSet('role', 'other').four

      this.dataCharacter = {
        level: 1,
        name: this.role.name,
        icon: `${this.screenData.pluResPath}img/role/${this.role.name}.png`,
        rarity: four.includes(Number(this.role.roleId)) ? 4 : 5
      }
    }

    skillList = skillList.filter((item) => item.max_level != 1)

    /** 拼接计算参数 */
    let body = {
      avatar_id: Number(this.role.roleId),
      avatar_level_current: Number(this.dataCharacter.level),
      avatar_level_target: Number(this.setSkill[0]),
      skill_list: [
        {
          id: Number(skillList[0].group_id),
          level_current: Number(skillList[0].level_current),
          level_target: Number(this.setSkill[2])
        },
        {
          id: Number(skillList[1].group_id),
          level_current: Number(skillList[1].level_current),
          level_target: Number(this.setSkill[3])
        },
        {
          id: Number(skillList[2].group_id),
          level_current: Number(skillList[2].level_current),
          level_target: Number(this.setSkill[4])
        }
      ]
    }

    if (this.mysApi.getServer().startsWith('os')) {
      body.lang = "zh-cn"
    }

    if (this.dataCharacter.weapon) {
      if (Number(this.dataCharacter.weapon.rarity) < 3) {
        this.setSkill[1] = 70
      }
      body.weapon = {
        id: Number(this.dataCharacter.weapon.id),
        level_current: Number(this.dataCharacter.weapon.level),
        level_target: Number(this.setSkill[1])
      }
    }
    this.skillList = skillList
    return body
  }

  async getSkillId (roleId) {
    let avatarSkill = await this.mysApi.getData('avatarSkill', { avatar_id: roleId })
    if (!avatarSkill || avatarSkill.retcode !== 0) return false
    avatarSkill = avatarSkill.data
    avatarSkill.list.forEach((item) => {
      item.level_current = 1
    })

    return avatarSkill.list
  }

  async computes (body) {
    let computes = await this.mysApi.getData('compute', body)
    if (!computes || computes.retcode !== 0) return false
    computes = computes.data

    let formart = (num) => {
      return num > 10000 ? (num / 10000).toFixed(1) + ' w' : num
    }

    for (let i in computes) {
      for (let j in computes[i]) {
        computes[i][j].num = formart(computes[i][j].num)

        if (computes[i][j].name.includes('「')) {
          computes[i][j].isTalent = true
        }
      }
    }

    return computes
  }
}
