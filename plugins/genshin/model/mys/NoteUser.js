/**
 * Bot实际User用户类
 * 主键QQ
 *
 *  User可以注册UID，通过 getRegUid / setRegUid
 *  一个User可以绑定多个MysUser CK，绑定MysUser
 */
import BaseModel from './BaseModel.js'
import lodash from 'lodash'
import MysUser from './MysUser.js'
import gsCfg from '../gsCfg.js'
import { UserDB } from '../db/index.js'
import { Data } from '#miao'

export default class NoteUser extends BaseModel {
  constructor (qq) {
    super()
    // 检查实例缓存
    let cacheObj = this._getThis('user', qq)
    if (cacheObj) {
      return cacheObj
    }
    this.qq = qq
    return this._cacheThis()
  }

  /**
   * 获取当前用户uid
   * 如果为绑定用户，优先获取ck对应uid，否则获取绑定uid
   */
  get uid () {
    return this.getUid()
  }

  /**
   * 当前用户是否具备CK
   */
  get hasCk () {
    return !lodash.isEmpty(this.mysUsers)
  }

  /**
   * 获取绑定CK的UID列表，如未绑定CK则返回空数组
   */
  get ckUids () {
    if (!this.hasCk) {
      return []
    }
    return lodash.map(this.ckData, 'uid')
  }

  /**
   * 获取当前生效CK
   *
   * 返回isMain的uid，没有的话返回首位
   */
  get mainCk () {
    if (this.hasCk) {
      return lodash.filter(this.ckData, (ck) => ck.isMain)[0] || lodash.values(this.ckData)[0]
    }
    return false
  }

  /**
   * 获取当前用户的所有ck
   * @returns { {ltuid:{ckData, ck, uids}} }
   */
  get cks () {
    console.log('NoteUser.cks 即将废弃')
    let game = 'gs'
    let cks = {}
    if (!this.hasCk) {
      return cks
    }
    for (let ltuid in this.mysUsers) {
      let mys = this.mysUsers[ltuid]
      if (mys && mys.ltuid && mys.uid) {
        cks[ltuid] = cks[ltuid] || {
          ckData: mys.getCkInfo(game),
          ck: mys.ck,
          uids: mys.getUids(game)
        }
      }
    }
    return cks
  }

  /**
   * 创建NoteUser实例
   * @param qq NoterUser对应id（qq）
   * * 若传入e对象则会识别e.user_id，并将user对象添加至e.user
   * @param data 用户对应MysCookie数据，为空则自动读取
   * @returns {Promise<NoteUser|*>}
   */
  static async create (qq, db) {
    // 兼容处理传入e
    if (qq && qq.user_id) {
      let e = qq
      let user = await NoteUser.create(e.user_id)
      e.user = user
      return user
    }

    let user = new NoteUser(qq)
    await user.initDB(db)

    // 检查绑定uid (regUid)
    await user.getRegUid()
    // 传入data则使用，否则读取
    return user
  }

  static async forEach (fn) {
    let dbs = await UserDB.findAll()
    await Data.forEach(users, async (db) => {
      let user = await NoteUser.create(db.id, db)
      return await fn(user)
    })
  }

  // 初始化数据
  async initDB (db = false) {
    if (this.db && !db) {
      return
    }
    // 为后续多类型用户兼容
    this.db = db && db !== true ? db : await UserDB.find(this.qq, 'qq')
    await this.initMysUser()
    this.initUids()
  }

  // 初始化MysUser对象
  async initMysUser () {
    let ltuids = this.db?.ltuids || ''
    this.mysUsers = {}
    for (let ltuid of ltuids.split(',')) {
      let mys = await MysUser.create(ltuid)
      if (mys) {
        this.mysUsers[ltuid] = mys
      }
    }
  }

  // 初始化Uid
  initUids () {
    let self = this
    self.uids = {}
    self.uidMap = {}
    const { db, uids, uidMap, mysUsers } = self
    lodash.forEach(['gs', 'sr'], (key) => {
      // 绑定UID
      uidMap[key] = {}
      uids[key] = []
      // 设置CK UID
      lodash.forEach(mysUsers, (mys) => {
        lodash.forEach(mys[`${key}Uids`], (uid) => {
          if (uid && !uidMap[key][uid]) {
            uidMap[key][uid] = { uid, type: 'ck', ltuid: mys.ltuid }
            uids[key].push(uid)
          }
        })
      })
      let regUids = db[`${key}RegUids`] || '{}'
      try {
        regUids = JSON.parse(regUids)
      } catch (e) {
        regUids = {}
      }
      lodash.forEach(['verify', 'reg'], (uidType) => {
        lodash.forEach(regUids, (ds, uid) => {
          if (uid && ds.type === uidType && !uidMap[key][uid]) {
            uidMap[key][uid] = { uid, type: ds.type }
            uids[key].push(uid)
          }
        })
      })
      self[`${key}Uid`] = self[`${key}Uid`] || db[`${key}Uid`] || uids[key]?.[0] || ''
    })
  }

  async save () {
    await this.db.saveDB(this)
  }

  // 获取当前UID
  getUid (game = 'gs') {
    return this.isGs(game) ? this.gsUid : this.srUid
  }

  getSelfUid (game = 'gs') {
    let gameKey = this.gameKey(game)
    let uids = this[`${gameKey}UidMap`].filter((v) => v.type === 'ck')
    if (uids.length === 0) {
      return false
    }
    let find = lodash.find(uids, (v) => v.uid + '' === uid + '', 0)
    return find ? find.uid : uids[0].uid
  }

  // 获取UID列表
  getUidList (game = 'gs') {
    let ret = []
    let gameKey = this.gameKey(game)
    lodash.forEach(this.uids[gameKey], (uid) => {
      ret.push(this.uidMap[gameKey][uid])
    })
    return ret
  }

  // 获取当前UID数据
  getUidData (game = 'gs') {
    let gameKey = this.gameKey(game)
    let uid = this.getUid(game)
    return this.uidMap[gameKey][uid]
  }

  // 获取当前的MysUser对象
  getMysUser (game = 'gs') {
    if (lodash.isEmpty(this.mysUsers)) {
      return false
    }
    let uidData = this.getUidData(game)
    let ltuid = lodash.keys(this.mysUsers)[0]
    if (uidData.type === 'ck') {
      ltuid = uidData.ltuid
    }
    return this.mysUsers[ltuid]
  }


  // 添加UID
  addRegUid (uid, game = 'gs') {
    let gameKey = this.gameKey(game)
    if (!this.uidMap[gameKey][uid]) {
      this.uidMap[gameKey][uid] = { uid, type: 'reg' }
      this.uids[gameKey].push(uid)
      this.setMainUid(uid, game)
    }
  }

  // 删除UID
  delRegUid (uid, game = 'gs') {
    let gameKey = this.gameKey(game)
    if (this.uidMap[gameKey][uid] && this.uidMap[gameKey][uid].type !== 'ck') {
      delete this.uidMap[gameKey][uid]
      lodash.remove(this.uids[gameKey], (u) => u === uid)
    }
  }

  /**
   * 获取当前用户的绑定UID
   * 主要供内部调用，建议使用 user.uid 获取用户uid
   * @returns {Promise<*>}
   */
  async getRegUid (game = 'gs') {
    let gameKey = this.gameKey(game)
    return this[`${gameKey}Uid`] || ''
  }

  /**
   * 设置当前用户的绑定uid
   * @param uid 要绑定的uid
   * @param game
   * @param force 若已存在绑定uid关系是否强制更新
   */
  async setRegUid (uid = '', game = 'gs', force = false) {
    if (this.getRegUid(game) && false) {
      return uid
    }
    await this.addRegUid(uid, game)
    return uid
  }

  // 切换绑定CK生效的UID
  setMainUid (uid = '', game = 'gs') {
    let gameKey = this.gameKey(game)
    // 兼容传入index
    if (uid < 100 && this.uids[gameKey][uid]) {
      uid = this.uids[gameKey][uid]
    }

    if (this.uidMap[gameKey][uid]) {
      if (this.isGs(game)) {
        this.gsUid = uid
      } else {
        this.srUid = uid
      }
    }
  }

  // 添加MysUser
  addMysUser (mysUser) {
    this.mysUsers[mysUser.ltuid] = mysUser
    this.initUids()
  }

  // 删除当前用户绑定CK
  async delCk (ltuid = '', needRefreshCache = true) {
    if (!this.mysUsers[ltuid]) {
      return false
    }
    delete this.mysUsers[ltuid]
    this.initUids()
  }

  /**
   * 检查当前用户绑定的CK状态
   */
  async checkCk () {
    // TODO:待完善文案
    let cks = this.cks
    let ret = []
    for (let ltuid in cks) {
      let ck = cks[ltuid].ck
      if (!ltuid || !ck) {
        continue
      }
      let checkRet = await MysUser.checkCkStatus(ck)
      // TODO: 若checkRet中返回了不同的uid，进行CK保存更新
      // 失效
      let mysUser = await MysUser.create(ck)
      if (mysUser) {
        let status = checkRet.status
        if (status === 0 || status === 1) {
          // status为1时无法查询天赋，但仍可查询角色，保留CK
          await mysUser.initCache()
        } else if (status === 2) {
          // status为2时无法查询角色，删除ck cache
          // 因仍能查询体力，故保留ck记录不直接删除
          await mysUser.del()
        } else if (status === 3) {
          // status为3时CK完全失效，用户删除此CK
          await this.delCk(ltuid)
        }
      }
      ret.push({
        ltuid,
        ...checkRet
      })
    }
    return ret
  }
}
