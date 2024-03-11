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

  /**
   * OLD Func {{
   */

  get uid () {
    console.warn('NoteUser.uid 默认返回原神UID，可更改为 user.getUid(game)')
    return this.getUid()
  }

  // 获取绑定CK的UID列表，如未绑定CK则返回空数组
  get ckUids () {
    console.warn('NoteUser.ckUids 默认返回原神UID，可更改为 user.getCkUidList(game)')
    let uids = this.getCkUidList('gs')
    return lodash.map(uids, (ds) => ds.uid)
  }

  /**
   * 获取当前用户的所有ck
   * @returns { {ltuid:{ckData, ck, uids}} }
   */
  get cks () {
    console.warn('NoteUser.cks 即将废弃')
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
   * End OLD Func }}
   */

  // 当前用户是否具备CK
  get hasCk () {
    return !lodash.isEmpty(this.mysUsers)
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
      let id = e.originalUserId || e.user_id
      let mainId = await redis.get(`Yz:NoteUser:mainId:${e.user_id}`)
      if (mainId) {
        id = mainId
        e.mainUserId = mainId
        e.originalUserId = e.originalUserId || e.user_id
      }
      let user = await NoteUser.create(id)
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
    await Data.forEach(dbs, async (db) => {
      let user = await NoteUser.create(db.id, db)
      return await fn(user)
    })
  }

  // 初始化数据
  async initDB (db = false) {
    if (this.db && !db) {
      return
    }
    if (db && db !== true) {
      this.db = db
    } else {
      this.db = await UserDB.find(this.qq, 'qq')
    }
    await this.initMysUser()
    this._games = this.db.games
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

  async save () {
    await this.db.saveDB(this)
  }


  getUidMapList (game = 'gs', type = 'all') {
    if (this._map?.[game]?.[type]) {
      return this._map[game][type]
    }
    game = this.gameKey(game)
    let uidMap = {}
    let uidList = []
    lodash.forEach(this.mysUsers, (mys) => {
      if (!mys) {
        return
      }
      lodash.forEach(mys.uids[game] || [], (uid) => {
        uid = uid + ''
        if (uid && !uidMap[uid]) {
          uidMap[uid] = mys.getUidData(uid, game)
          uidList.push(uidMap[uid])
        }
      })
    })
    if (type === 'all') {
      let gameDs = this.getGameDs(game)
      lodash.forEach(gameDs.data, (ds) => {
        if (ds.uid && !uidMap[ds.uid]) {
          uidMap[ds.uid] = ds
          uidList.push(ds)
        }
      })
    }

    this._map = this._map || {}
    this._map[game] = this._map[game] || {}
    this._map[game][type] = {
      map: uidMap,
      list: uidList
    }
    return this._map[game][type]
  }


  getUidData (uid = '', game = 'gs') {
    if (!uid) {
      uid = this.getUid(game)
    }
    return this.getUidMapList(game, 'all').map[uid]
  }

  /** 有Uid */
  hasUid (uid = '', game = '') {
    if (!uid) {
      return this.getUidMapList(game, 'all').list?.length > 0
    }
    return !!this.getUidData(uid, game)
  }

  /** 获取CK-Uid */
  getCkUid (game = 'gs') {
    let uid = this.getUid(game)
    let { map, list } = this.getUidMapList(game, 'ck')
    return (map[uid] ? uid : list[0]?.uid) || ''
  }

  /** 获取CK-Uid列表 */
  getCkUidList (game = 'gs') {
    return this.getUidMapList(game, 'ck').list
  }

  /** 获取当前UID */
  getUid (game = 'gs') {
    game = this.gameKey(game)
    // todo 刷新uid
    let ds = this.getGameDs(game)
    if (!ds.uid) {
      this.setMainUid('', game)
    }
    return ds.uid || ''
  }

  /** 获取UID列表 */
  getUidList (game = 'gs') {
    return this.getUidMapList(game, 'all').list
  }

  /** 获取当前的MysUser对象 */
  getMysUser (game = 'gs') {
    if (lodash.isEmpty(this.mysUsers)) {
      return false
    }
    let uid = this.getCkUid(game)
    if (!uid) {
      return false
    }
    let uidData = this.getUidData(uid, game)
    return this.mysUsers[uidData.ltuid]
  }

  // 添加UID
  addRegUid (uid, game = 'gs', save = true) {
    game = this.gameKey(game)
    uid = uid + ''
    let gameDs = this.getGameDs(game)
    gameDs.data[uid] = { uid, type: 'reg' }
    this._map = false
    this.setMainUid(uid, game, false)
    if (save) {
      this.save()
    }
  }

  // 删除UID
  delRegUid (uid, game = 'gs') {
    game = this.gameKey(game)
    let gameDs = this.getGameDs(game)
    let dsData = gameDs.data
    delete dsData[uid]
    gameDs.data = dsData
    this._map = false
    if (gameDs.uid === uid) {
      this.setMainUid('', game, false)
    }
    this.save()
  }

  getGameDs (game = 'gs') {
    game = this.gameKey(game)
    if (!this._games[game]) {
      this._games[game] = {
        uid: '',
        data: {}
      }
    }
    return this._games[game]
  }


  /**
   * 设置当前用户的绑定uid
   * @param uid 要绑定的uid
   * @param game
   */
  autoRegUid (uid = '', game = 'gs') {
    if (this.getUid(game)) {
      return uid
    }
    this.addRegUid(uid, game)
    return uid
  }

  // 切换绑定CK生效的UID
  setMainUid (uid = '', game = 'gs', save = true) {
    this._map = false
    game = this.gameKey(game)
    if (uid < 100 || !uid) {
      let uids = this.getUidList(game)
      uid = (uids?.[uid] || uids?.[0])?.uid || ''
    }
    if (!uid) {
      return false
    }
    if (this.hasUid(uid, game)) {
      let gameDs = this.getGameDs(game)
      gameDs.uid = uid
    }
    if (save) {
      this.save()
    }
  }

  // 添加MysUser
  async addMysUser (mysUser) {
    this.mysUsers[mysUser.ltuid] = mysUser
    this._map = false
    MysUtil.eachGame((game) => {
      let uid = mysUser.getUid(game)
      if (uid && this.getUid(game) == '') {
        this.setMainUid(uid, game, false)
      }
    })
    this.save()
  }

  // 删除当前用户绑定CK
  async delCk (ltuid = '') {
    console.warn('delCk即将废弃')
    return await this.delMysUser(ltuid)
  }

  async delMysUser (mysUser = '') {
    let ltuid = mysUser.ltuid || mysUser
    if (ltuid && this.mysUsers[ltuid]) {
      let mys = this.mysUsers[ltuid]
      this.mysUsers[ltuid] = false
      this._map = false
      await mys.del()
    }
    this._map = false
    await this.save()
  }

  async eachMysUser (fn) {
    await Data.forEach(this.mysUsers, async (mys, ltuid) => {
      if (!mys) {
        return true
      }
      return fn(mys, ltuid)
    })
  }

  async eachAllMysUser (fn) {
    return MysUser.forEach(fn)
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
