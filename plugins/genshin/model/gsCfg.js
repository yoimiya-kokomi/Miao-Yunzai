import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import lodash from 'lodash'
import MysInfo from './mys/mysInfo.js'
import NoteUser from './mys/NoteUser.js'
import { Character, Weapon } from '#miao.models'

/** 配置文件 */
class GsCfg {
  constructor () {
    this.isSr = false
    /** 默认设置 */
    this.defSetPath = './plugins/genshin/defSet/'
    this.defSet = {}

    /** 用户设置 */
    this.configPath = './plugins/genshin/config/'
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.ignore = ['mys.pubCk', 'gacha.set', 'bot.help', 'role.name']
  }

  get element () {
    return { ...this.getdefSet('element', 'role'), ...this.getdefSet('element', 'weapon') }
  }

  /**
   * @param app  功能
   * @param name 配置文件名称
   */
  getdefSet (app, name) {
    return this.getYaml(app, name, 'defSet')
  }

  /** 用户配置 */
  getConfig (app, name) {
    if (this.ignore.includes(`${app}.${name}`)) {
      return this.getYaml(app, name, 'config')
    }

    return { ...this.getdefSet(app, name), ...this.getYaml(app, name, 'config') }
  }

  /**
   * 获取配置yaml
   * @param app 功能
   * @param name 名称
   * @param type 默认跑配置-defSet，用户配置-config
   */
  getYaml (app, name, type) {
    let file = this.getFilePath(app, name, type)
    let key = `${app}.${name}`

    if (this[type][key]) return this[type][key]

    try {
      this[type][key] = YAML.parse(
        fs.readFileSync(file, 'utf8')
      )
    } catch (error) {
      logger.error(`[${app}][${name}] 格式错误 ${error}`)
      return false
    }

    this.watch(file, app, name, type)

    return this[type][key]
  }

  getFilePath (app, name, type) {
    if (type == 'defSet') {
      return `${this.defSetPath}${app}/${name}.yaml`
    } else {
      return `${this.configPath}${app}.${name}.yaml`
    }
  }

  /** 监听配置文件 */
  watch (file, app, name, type = 'defSet') {
    let key = `${app}.${name}`

    if (this.watcher[type][key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this[type][key]
      logger.mark(`[修改配置文件][${type}][${app}][${name}]`)
      if (this[`change_${app}${name}`]) {
        this[`change_${app}${name}`]()
      }
    })

    this.watcher[type][key] = watcher
  }

  /** 读取所有用户绑定的ck */
  async getBingCk (game = 'gs') {
    let ck = {}
    let ckQQ = {}
    let noteCk = {}

    await NoteUser.forEach(async function (user) {
      let qq = user.qq + ''
      let tmp = {}
      lodash.forEach(user.mysUsers, (mys) => {
        let uids = mys.getUids(game)
        lodash.forEach(uids, (uid) => {
          let ckData = mys.getCkInfo(game)
          ckData.qq = qq
          if (!ck[uid]) {
            ck[uid] = ckData
            ckQQ[qq] = ckData
          }
          tmp[uid] = ckData
        })
      })
      noteCk[qq] = tmp
    })
    return { ck, ckQQ, noteCk }
  }

  /**
   * 原神角色id转换角色名字
   */
  roleIdToName (id) {
    let char = Character.get(id)
    return char?.name || ''
  }

  /** 原神角色别名转id */
  roleNameToID (keyword, isSr) {
    let char = Character.get(keyword, isSr ? 'sr' : 'gs')
    return char?.id || false
  }


  /**
   * 原神角色武器长名称缩写
   * @param name 名称
   * @param isWeapon 是否武器
   */
  shortName (name, isWeapon = false) {
    let obj = (isWeapon ? Weapon : Character).get(name)
    return obj.abbr || obj.name || ''
  }

  /** 公共配置ck文件修改hook */
  async change_myspubCk () {
    await MysInfo.initCache()
    await MysInfo.initPubCk()
  }

  getGachaSet (groupId = '') {
    let config = this.getYaml('gacha', 'set', 'config')
    let def = config.default
    if (config[groupId]) {
      return { ...def, ...config[groupId] }
    }
    return def
  }

  getMsgUid (msg) {
    let ret = /[1|2|5-9][0-9]{8}/g.exec(msg)
    if (!ret) return false
    return ret[0]
  }

  /**
   * 获取消息内原神角色名称，uid
   * @param msg 判断消息
   * @param filterMsg 过滤消息
   * @return roleId 角色id
   * @return name 角色名称
   * @return alias 当前别名
   * @return uid 游戏uid
   */
  getRole (msg, filterMsg = '', isSr = false) {
    let alias = msg.replace(/#|老婆|老公|[1|2|3|5-9][0-9]{8}/g, '').trim()
    if (filterMsg) {
      alias = alias.replace(new RegExp(filterMsg, 'g'), '').trim()
    }

    this.isSr = isSr

    let char = Character.get(alias, isSr ? 'sr' : 'gs')
    if (!char) {
      return false
    }

    /** 获取uid */
    let uid = this.getMsgUid(msg) || ''

    return {
      roleId: char.id,
      uid,
      alias,
      game: char.game,
      name: char.name
    }
  }


  cpCfg (app, name) {
    if (!fs.existsSync('./plugins/genshin/config')) {
      fs.mkdirSync('./plugins/genshin/config')
    }

    let set = `./plugins/genshin/config/${app}.${name}.yaml`
    if (!fs.existsSync(set)) {
      fs.copyFileSync(`./plugins/genshin/defSet/${app}/${name}.yaml`, set)
    }
  }

  // 仅供内部调用
  _getAbbr () {
    if (this[this.isSr ? 'sr_nameID' : 'nameID']) return

    this.nameID = new Map()
    this.sr_nameID = new Map()
    let nameArr = this.getdefSet('role', 'name')
    let sr_nameArr = this.getdefSet('role', 'sr_name')
    let nameArrUser = this.getConfig('role', 'name')

    let nameID = {}

    for (let i in nameArr) {
      nameID[nameArr[i][0]] = i
      for (let abbr of nameArr[i]) {
        this.nameID.set(String(abbr), i)
      }
    }

    for (let i in sr_nameArr) {
      nameID[sr_nameArr[i][0]] = i
      for (let abbr of sr_nameArr[i]) {
        this.sr_nameID.set(String(abbr), i)
      }
    }

    for (let i in nameArrUser) {
      for (let abbr of nameArrUser[i]) {
        this.nameID.set(String(abbr), nameID[i])
      }
    }
  }


  // 仅供内部调用
  _roleNameToID (keyword, isSr) {
    if (isSr) this.isSr = isSr
    if (!isNaN(keyword)) keyword = Number(keyword)
    this._getAbbr()
    let roelId = this[this.isSr ? 'sr_nameID' : 'nameID'].get(String(keyword))
    return roelId || false
  }

  // 仅供内部调用
  _getRole (msg, filterMsg = '', isSr = false) {
    let alias = msg.replace(/#|老婆|老公|[1|2|3|5-9][0-9]{8}/g, '').trim()
    if (filterMsg) {
      alias = alias.replace(new RegExp(filterMsg, 'g'), '').trim()
    }

    /** 判断是否命中别名 */
    let roleId = this._roleNameToID(alias)
    if (!roleId) return false
    /** 获取uid */
    let uid = this.getMsgUid(msg) || ''

    return {
      roleId,
      uid,
      alias,
      name: this.roleIdToName(roleId)
    }
  }

  getWeaponDataByWeaponHash (hash) {
    console.log('gsCfg.getWeaponDataByWeaponHash() 已废弃')
    return {}
  }

  getAllAbbr () {
    console.log('gsCfg.getAllAbbr() 已废弃')
    return {}
  }

  getBingCkSingle (userId) {
    console.log('gsCfg.getBingCkSingle() 已废弃')
    return {}
  }

  saveBingCk (userId, data) {
    console.log('gsCfg.saveBingCk() 已废弃')
  }

  getElementByRoleName (roleName) {
    console.log('gsCfg.getElementByRoleName() 已废弃')
    return ''
  }

  getSkillDataByskillId (skillId, roleName) {
    console.log('gsCfg.getSkillDataByskillId() 已废弃')
    return {}
  }

  fightPropIdToName (propId) {
    console.log('gsCfg.fightPropIdToName() 已废弃')
    return ''
  }

  getRoleTalentByTalentId (talentId) {
    console.log('gsCfg.getRoleTalentByTalentId 已废弃')
    return {}
  }

  getAbbr () {
    console.log('gsCfg.getAbbr() 已经废弃')
  }

}

export default new GsCfg()
