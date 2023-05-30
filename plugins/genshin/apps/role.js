import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import gsCfg from '../model/gsCfg.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import RoleIndex from '../model/roleIndex.js'
import RoleDetail from '../model/roleDetail.js'
import Abyss from '../model/abyss.js'
import Weapon from '../model/weapon.js'
import RoleBag from '../model/roleBag.js'
import RoleList from '../model/roleList.js'
export class role extends plugin {
  constructor () {
    super({
      name: '角色查询',
      dsc: '原神角色信息查询',
      event: 'message',
      priority: 200,
      rule: [
        {
          reg: '^(#(角色|查询|查询角色|角色查询|人物)[ |0-9]*$)|(^(#*uid|#*UID)\\+*[1|2|5-9][0-9]{8}$)|(^#[\\+|＋]*[1|2|5-9][0-9]{8})',
          fnc: 'roleIndex'
        },
        {
          reg: '^#角色详情[0-9]*$',
          fnc: 'roleDetail'
        },
        {
          reg: '^(#*角色3|#*角色卡片|角色)$',
          fnc: 'roleCard'
        },
        {
          reg: '^#[上期|往期|本期]*(深渊|深境|深境螺旋)[上期|往期|本期]*[ |0-9]*$',
          fnc: 'abyss'
        },
        {
          reg: '^#*[上期|往期|本期]*(深渊|深境|深境螺旋)[上期|往期|本期]*[第]*(9|10|11|12|九|十|十一|十二)层[ |0-9]*$',
          fnc: 'abyssFloor'
        },
        {
          reg: '^#[五星|四星|5星|4星]*武器[ |0-9]*$',
          fnc: 'weapon'
        },
        {
          reg: '^#(五星|四星|5星|4星|命座|角色|武器)[命座|角色|背包]*[信息|阵容]*[ |0-9]*$',
          fnc: 'roleBag'
        },
        {
          reg: '^#*(我的)*(技能|天赋|武器|角色|练度|五|四|5|4|星)+(汇总|统计|列表)(force|五|四|5|4|星)*[ |0-9]*$',
          fnc: 'roleList'
        },
        {
          reg: '^#(角色2|宝箱|成就|尘歌壶|家园|探索|探险|声望|探险度|探索度)[ |0-9]*$',
          fnc: 'roleExplore'
        }
      ]
    })
  }

  /** 初始化配置文件 */
  async init () {

    let pubCk = './plugins/genshin/config/mys.pubCk.yaml'
    if (!fs.existsSync(pubCk)) {
      fs.copyFileSync('./plugins/genshin/defSet/mys/pubCk.yaml', pubCk)
    }

    let set = './plugins/genshin/config/mys.set.yaml'
    if (!fs.existsSync(set)) {
      fs.copyFileSync('./plugins/genshin/defSet/mys/set.yaml', set)
    }

    if (!fs.existsSync('./data/roleDetail')) {
      fs.mkdirSync('./data/roleDetail')
    }
  }

  /** 接受到消息都会先执行一次 */
  accept () {
    if (!this.e.msg) return
    if (!/^#(.*)$/.test(this.e.msg)) return

    let role = gsCfg.getRole(this.e.msg)
    if (role) {
      /** 设置命令 */
      this.e.msg = '#角色详情'
      if (role.uid) this.e.msg += role.uid
      /** 角色id */
      this.e.roleId = role.roleId
      /** 角色名称 */
      this.e.roleName = role.alias
      return true
    }
  }

  /** #角色 */
  async roleIndex () {
    let data = await RoleIndex.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleIndex', data)
    if (img) await this.reply(img)
  }

  /** 刻晴 */
  async roleDetail () {
    let data = await RoleDetail.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleDetail', data)
    if (img) await this.reply(img)
  }

  /** 深渊 */
  async abyss () {
    let data = await new Abyss(this.e).getAbyss()
    if (!data) return

    let img = await puppeteer.screenshot('abyss', data)
    if (img) await this.reply(img)
  }

  /** 深渊十二层 */
  async abyssFloor () {
    let data = await new Abyss(this.e).getAbyssFloor()
    if (!data) return

    let img = await puppeteer.screenshot('abyssFloor', data)
    if (img) await this.reply(img)
  }

  /** 武器 */
  async weapon () {
    let data = await Weapon.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('weapon', data)
    if (img) await this.reply(img)
  }

  /** 角色背包 */
  async roleBag () {
    let data = await RoleBag.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleBag', data)
    if (img) await this.reply(img)
  }

  /** 练度统计 */
  async roleList () {
    let data = await RoleList.get(this.e)
    if (!data) return

    let img = await puppeteer.screenshot('roleList', data)
    if (img) await this.reply(img)
  }

  /** 角色卡片 */
  async roleCard () {
    let data = await new RoleIndex(this.e).roleCard()
    if (!data) return

    let img = await puppeteer.screenshot('roleCard', data)
    if (img) await this.reply(img)
  }

  /** 探险 */
  async roleExplore () {
    let data = await new RoleIndex(this.e).roleExplore()
    if (!data) return

    let img = await puppeteer.screenshot('roleExplore', data)
    if (img) await this.reply(img)
  }
}
