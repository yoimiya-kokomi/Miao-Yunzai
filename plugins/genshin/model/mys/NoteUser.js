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
import MysUtil from './MysUtil.js'
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

  get uid () {
    console.log('NoteUser.uid 默认返回原神UID，可更改为 user.getUid(game)')
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
    let ret = []
    return lodash.map(this.ckData, 'uid')
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
   * @param db
   * * 若传入e对象则会识别e.user_id，并将user对象添加至e.user
   * @param data 用户对应MysCookie数据，为空则自动读取
   * @returns {Promise<NoteUser|*>}
   */
  static async create (qq, db = false) {
    // 兼容处理传入e
    if (qq && qq.user_id) {
      let e = qq
      let user = await NoteUser.create(e.user_id)
      e.user = user
      return user
    }

    let user = new NoteUser(qq)
    await user.initDB(db)

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
    await this.save()
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
  initUids (setMainUid = {}) {
    let self = this
    self.mainUid = self.mainUid || {}
    self.uidList = {}
    self.uidMap = self.uidMap || {}
    self.games = {}
    const { db, mainUid, uidList, games, uidMap, mysUsers } = self

    let gameDBs = {}
    lodash.forEach(db?.games, (gameDB) => {
      gameDBs[gameDB.game] = gameDB
    })

    MysUtil.eachGame((key) => {
      let gameDB = gameDBs[key]
      uidMap[key] = {}
      uidList[key] = []
      games[key] = gameDB
      // 优先设置CK UID
      lodash.forEach(mysUsers, (mys) => {
        lodash.forEach(mys.uids[key] || [], (uid) => {
          uid = uid + ''
          if (uid && !uidMap[key][uid]) {
            uidMap[key][uid] = { uid, type: 'ck', ltuid: mys.ltuid }
            uidList[key].push(uid)
          }
        })
      })

      let uidReg = /\d{9}/
      let regUidCount = 0

      // 存在数据库记录则进行设置
      if (gameDB) {
        let regUids = gameDB.data
        // 依次设置verify、reg uid数据
        lodash.forEach(['verify', 'reg'], (uidType) => {
          lodash.forEach(regUids, (ds, uid) => {
            uid = uid + ''
            if (regUidCount <= 5 && uid && uidReg.test(uid) && ds.type === uidType && !uidMap[key][uid]) {
              uidMap[key][uid] = { uid, type: ds.type }
              uidList[key].push(uid)
              regUidCount++
            }
          })
        })

        // 如果当前选中uid未在记录中，则补充为reg数据
        let uid = gameDB.uid
        if (uid && !uidMap[key][uid]) {
          uid = uid + ''
          uidMap[key][uid] = { uid, type: 'reg' }
          uidList[key].push(uid)
        }
      }
      // 设置选中uid
      if (setMainUid === false || setMainUid[key] === false) {
        mainUid[key] = uidList[key]?.[0] || ''
      } else {
        mainUid[key] = setMainUid[key] || mainUid[key] || gameDB?.uid || uidList[key]?.[0] || ''
      }
    })
  }

  async save () {
    await this.db.saveDB(this)
  }

  // 获取当前UID
  getUid (game = 'gs') {
    let gameKey = this.gameKey(game)
    return this.mainUid[gameKey] || this.uidList[gameKey][0] || ''
  }

  getSelfUid (game = 'gs') {
    let gameKey = this.gameKey(game)
    let uidList = this.uidMap[gameKey].filter((v) => v.type === 'ck')
    if (uidList.length === 0) {
      return false
    }
    let find = lodash.find(uidList, (v) => v.uid + '' === uid + '', 0)
    return find ? find.uid : uidList[0].uid
  }

  // 获取UID列表
  getUidList (game = 'gs') {
    let ret = []
    let gameKey = this.gameKey(game)
    lodash.forEach(this.uidList[gameKey], (uid) => {
      ret.push(this.uidMap[gameKey][uid])
    })
    return ret
  }

  // 获取当前UID数据
  getUidData (game = 'gs') {
    let gameKey = this.gameKey(game)
    let uid = this.getUid(game)
    return this.uidMap[gameKey]?.[uid]
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
  async addRegUid (uid, game = 'gs') {
    let gameKey = this.gameKey(game)
    uid = uid + ''
    if (!this.uidMap[gameKey][uid]) {
      this.uidMap[gameKey][uid] = { uid, type: 'reg' }
    }
    await this.save()
    this.setMainUid(uid, game)
    // todo 优化保存
    await this.save()
  }

  // 删除UID
  async delRegUid (uid, game = 'gs') {
    let gameKey = this.gameKey(game)
    if (this.uidMap[gameKey][uid] && this.uidMap[gameKey][uid].type !== 'ck') {
      lodash.remove(this.uidList[gameKey], (u) => u + '' === uid + '')
      delete this.uidMap[gameKey][uid]
    }
    await this.save()
    if (this.mainUid[gameKey] === uid) {
      this.setMainUid(this.uidList[gameKey][0], game)
      await this.save()
    }
  }

  /**
   * 获取当前用户的绑定UID
   * 主要供内部调用，建议使用 user.uid 获取用户uid
   * @returns {Promise<*>}
   */
  async getRegUid (game = 'gs') {
    let gameKey = this.gameKey(game)
    return this.mainUid[gameKey] || ''
  }

  /**
   * 设置当前用户的绑定uid
   * @param uid 要绑定的uid
   * @param game
   * @param force 若已存在绑定uid关系是否强制更新
   */
  async setRegUid (uid = '', game = 'gs', force = false) {
    if (this.getRegUid(game) && !force) {
      return uid
    }
    await this.addRegUid(uid, game)
    return uid
  }

  // 切换绑定CK生效的UID
  setMainUid (uid = '', game = 'gs') {
    let gameKey = this.gameKey(game)
    // 兼容传入index
    if (uid < 100 && this.uidList[gameKey][uid]) {
      uid = this.uidList[gameKey][uid]
    }
    if (this.uidMap[gameKey][uid]) {
      this.mainUid[gameKey] = uid
    }
    let mainUid = {}
    mainUid[gameKey] = uid
    this.initUids(mainUid)
  }

  // 添加MysUser
  addMysUser (mysUser) {
    this.mysUsers[mysUser.ltuid] = mysUser
    this.initUids(mysUser.getMainUid())
  }

  // 删除当前用户绑定CK
  async delCk (ltuid = '') {
    console.log('delCk即将废弃')
    return await this.delMysUser(ltuid)

  }

  async delMysUser (ltuid = '') {
    if (ltuid && this.mysUsers[ltuid]) {
      let mys = this.mysUsers[ltuid]
      delete this.mysUsers[ltuid]
      await mys.del()
    }
    this.initUids(false)
    await this.save()
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
