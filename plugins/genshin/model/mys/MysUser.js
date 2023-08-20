/**
 * MysUser 米游社用户类
 * 主键ltuid
 *
 * 一个MysUser对应一个有效CK
 * 一个MysUser可能有多个MysUid关联记录
 */
import DailyCache from './DailyCache.js'
import BaseModel from './BaseModel.js'
import NoteUser from './NoteUser.js'
import MysApi from './mysApi.js'
import MysUtil from './MysUtil.js'
import lodash from 'lodash'
import fetch from 'node-fetch'
import { MysUserDB, UserDB } from '../db/index.js'
import { Data } from '../../../miao-plugin/components/index.js'

const tables = {
  // ltuid-uid 查询表
  // 表结构：Key-List (key:ltuid，list-item: uid)
  detail: 'query-detail',

  // ltuid-uid 关系表，用于存储ltuid对应uid列表，一个uid仅属于一个ltuid
  // 表结构：Key-List (key:ltuid， value:uid/qq)
  uid: 'ltuid-uid',

  // ltuid-ck 关系表，用于存储ltuid对应ck信息
  // 表结构：Key-Value (key:ltuid， value:ck)
  ck: 'ltuid-ck',

  // ltuid-qq 关系表，用于存储ltuid对应qq，一个ltuid可被多个qq绑定
  // 表结构：Key-Value (key:ltuid， value:[qq])
  // 因为一个qq可以绑定多个ltuid，所以不适宜用Key-List
  qq: 'ltuid-qq',

  // ltuid 已删除的uid查询，供解绑ltuid后重新绑回的查询记录恢复
  // 表结构：Key-Value (key:ltuid，value：序列化uid数组）
  del: 'del-detail'
}

export default class MysUser extends BaseModel {

  constructor (ltuid) {
    super()
    if (!ltuid) {
      return false
    }
    // 检查实例缓存
    let self = this._getThis('mys', ltuid)
    if (!self) {
      self = this
    }
    this.ltuid = ltuid
    return self._cacheThis()
  }

  // 可传入ltuid、cookie、ck对象来创建MysUser实例

  get uid () {
    return this.uids?.gs?.[0] || ''
  }

  // 在仅传入ltuid时，必须是之前传入过的才能被识别
  static async create (ltuid, db = false) {
    ltuid = MysUtil.getLtuid(ltuid)
    if (!ltuid) {
      return false
    }
    let mys = new MysUser(ltuid)
    await mys.initDB(db)
    return mys
  }

  static async forEach (fn) {
    let dbs = await MysUserDB.findAll()
    await Data.forEach(dbs, async (db) => {
      let mys = await MysUser.create(db.ltuid, db)
      return await fn(mys)
    })
  }

  // 根据uid获取查询MysUser
  static async getByQueryUid (uid, game = 'gs', onlySelfCk = false) {
    let servCache = DailyCache.create(uid, game)
    // 查找已经查询过的ltuid || 分配最少查询的ltuid

    // 根据ltuid获取mysUser 封装
    const create = async function (ltuid) {
      if (!ltuid) return false

      let ckUser = await MysUser.create(ltuid)
      if (!ckUser) {
        await servCache.zDel(tables.detail, ltuid)
        return false
      }

      // 若声明只获取自己ck，则判断uid是否为本人所有
      if (onlySelfCk && !ckUser.ownUid(uid, game)) {
        return false
      }

      return ckUser
    }

    // 根据uid检索已查询记录。包括公共CK/自己CK/已查询过
    let ret = await create(await servCache.zKey(tables.detail, uid))
    if (ret) {
      logger.mark(`[米游社查询][uid：${uid}]${logger.green(`[使用已查询ck：${ret.ltuid}]`)}`)
      return ret
    }

    // 若只获取自身ck，则无需走到分配逻辑
    if (onlySelfCk) return false

    // 使用CK池内容，分配次数最少的一个ltuid
    ret = await create(await servCache.zMinKey(tables.detail))
    if (ret) {
      logger.mark(`[米游社查询][uid：${uid}]${logger.green(`[分配查询ck：${ret.ltuid}]`)}`)
      return ret
    }

    return false
  }

  static async eachServ (fn) {
    await MysUtil.eachServ(async (serv) => {
      await MysUtil.eachGame(async (game) => {
        let servCache = DailyCache.create(serv, game)
        await fn(servCache, serv, game)
      })
    })
  }

  // 清除当日缓存
  static async clearCache () {
    await MysUser.eachServ(async function (servCache) {
      await servCache.empty(tables.detail)
    })
    let cache = DailyCache.create()
    await cache.empty(tables.uid)
    await cache.empty(tables.ck)
    await cache.empty(tables.qq)
  }

  // 获取用户统计数据
  static async getStatData () {
    let totalCount = {}
    let ret = { servs: {} }
    await MysUser.eachServ(async function (servCache, serv) {
      let data = await servCache.zStat(tables.detail)
      let count = {}
      let list = []
      let query = 0
      const stat = (type, num) => {
        count[type] = num
        totalCount[type] = (totalCount[type] || 0) + num
      }
      lodash.forEach(data, (ds) => {
        list.push({
          ltuid: ds.value,
          num: ds.score
        })
        if (ds.score < 30) {
          query += ds.score
        }
      })
      stat('total', list.length)
      stat('normal', lodash.filter(list, ds => ds.num < 29).length)
      stat('disable', lodash.filter(list, ds => ds.num > 30).length)
      stat('query', query)
      stat('last', count.normal * 30 - count.query)
      list = lodash.sortBy(list, ['num', 'ltuid']).reverse()
      ret.servs[serv] = {
        list, count
      }
    })
    ret.count = totalCount
    return ret
  }

  /**
   * 删除失效用户
   * @returns {Promise<number>} 删除用户的个数
   */
  static async delDisable () {
    let count = 0
    await MysUser.eachServ(async function (servCache) {
      let cks = await servCache.zGetDisableKey(tables.detail)
      for (let ck of cks) {
        if (await servCache.zDel(tables.detail, ck, true)) {
          count++
        }
        let ckUser = await MysUser.create(ck)
        if (ckUser) {
          await ckUser.delWithUser()
        }
      }
    })
    return count
  }

  /**
   * 检查CK状态
   * @param ck 需要检查的CK
   * @returns {Promise<boolean|{msg: string, uids: *[], status: number}>}
   */
  static async checkCkStatus (ck) {
    let uids = []
    let err = (msg, status = 2) => {
      msg = msg + '\n请退出米游社并重新登录后，再次获取CK'
      return {
        status,
        msg,
        uids
      }
    }
    if (!ck) {
      return false
    }

    // 检查绑定UID
    uids = await MysUser.getCkUid(ck, true, true)
    if (!uids.uids || uids.uids.length === 0) {
      return err(uids.msg || 'CK失效')
    }
    uids = uids.uids
    let uid = uids[0]
    let mys = new MysApi(uid + '', ck, { log: false })
    // 体力查询
    let noteRet = await mys.getData('dailyNote')
    if (noteRet.retcode !== 0 || lodash.isEmpty(noteRet.data)) {
      let msg = noteRet.message !== 'OK' ? noteRet.message : 'CK失效'
      return err(`${msg || 'CK失效或验证码'}，无法查询体力及角色信息`, 3)
    }

    // 角色查询
    let roleRet = await mys.getData('character')
    if (roleRet.retcode !== 0 || lodash.isEmpty(roleRet.data)) {
      let msg = noteRet.message !== 'OK' ? noteRet.message : 'CK失效'
      return err(`${msg || 'CK失效'}，当前CK仍可查询体力，无法查询角色信息`, 2)
    }

    let detailRet = await mys.getData('detail', { avatar_id: 10000021 })
    if (detailRet.retcode !== 0 || lodash.isEmpty(detailRet.data)) {
      let msg = noteRet.message !== 'OK' ? noteRet.message : 'CK失效'
      return err(`${msg || 'CK失效'}，当前CK仍可查询体力及角色，但无法查询角色详情数据`, 1)
    }
    return {
      uids,
      status: 0,
      msg: 'CK状态正常'
    }
  }

  // 不建议使用，为了兼容老数据格式，后续废弃
  getCkInfo (game = 'gs') {
    return {
      ck: this.ck,
      uid: this.getUid(game),
      qq: '',
      ltuid: this.ltuid
    }
  }

  getUidData (uid, game = 'gs') {
    game = this.gameKey(game)
    if (!this.hasUid(uid, game)) {
      return false
    }
    return {
      uid,
      type: 'ck',
      ltuid: this.ltuid,
      game
    }
  }

  hasUid (uid, game = 'gs') {
    game = this.gameKey(game)
    return this.uids[game].includes(uid + '')
  }

  getUid (game = 'gs') {
    return this.getUids(game)[0]
  }

  getUids (game = 'gs') {
    let gameKey = this.gameKey(game)
    return this.uids[gameKey] || []
  }

  getUidInfo () {
    let ret = []
    MysUtil.eachGame((game, gameDs) => {
      let uids = this.getUids(game)
      if (uids && uids.length > 0) {
        ret.push(`【${gameDs.name}】:${uids.join(', ')}`)
      }
    })
    return ret.join('\n')
  }

  /**
   * 刷新mysUser的UID列表
   * @returns {Promise<{msg: string, status: number}>}
   */
  async reqMysUid () {
    let err = (msg = 'error', status = 1) => {
      return { status, msg }
    }

    let res = null
    let msg = 'error'
    for (let serv of ['mys', 'hoyolab']) {
      let roleRes = await this.getGameRole(serv)
      if (roleRes?.retcode === 0) {
        res = roleRes
        if (serv === 'hoyolab') {
          this.type = 'hoyolab'
        }
        break
      }
      if (roleRes.retcode * 1 === -100) {
        msg = '该ck已失效，请重新登录获取'
      }
      msg = roleRes.message || 'error'
    }

    if (!res) return err(msg)
    let playerList = res?.data?.list || []
    playerList = playerList.filter(v => ['hk4e_cn', 'hkrpg_cn', 'hk4e_global', 'hkrpg_global'].includes(v.game_biz))
    if (!playerList || playerList.length <= 0) {
      return err('该账号尚未绑定原神或星穹角色')
    }

    this.gsUids = []
    this.srUids = []

    /** 米游社默认展示的角色 */
    for (let val of playerList) {
      this.addUid(val.game_uid, ['hk4e_cn', 'hk4e_global'].includes(val.game_biz) ? 'gs' : 'sr')
    }
    await this.save()
    return { status: 0, msg: '' }
  }

  async getGameRole (serv = 'mys') {
    let ck = this.ck
    let url = {
      mys: 'https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie',
      hoyolab: 'https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie'
    }

    let res = await fetch(url[serv], { method: 'get', headers: { Cookie: ck } })
    if (!res.ok) return false
    res = await res.json()

    return res
  }

  // 获取米游社通行证id
  async getUserFullInfo (serv = 'mys') {
    let ck = this.ck
    let url = {
      mys: 'https://bbs-api.mihoyo.com/user/wapi/getUserFullInfo?gids=2',
      hoyolab: ''
    }
    let res = await fetch(url[serv], {
      method: 'get',
      headers: {
        Cookie: ck,
        Accept: 'application/json, text/plain, */*',
        Connection: 'keep-alive',
        Host: 'bbs-api.mihoyo.com',
        Origin: 'https://m.bbs.mihoyo.com',
        Referer: ' https://m.bbs.mihoyo.com/'
      }
    })
    if (!res.ok) return res
    res = await res.json()
    return res
  }

  getCache (game = 'gs') {
    if (!this.cache) {
      this.cache = {}
    }
    const { cache } = this
    if (game !== 'config') {
      game = this.gameKey(game)
    }
    if (!cache[game]) {
      cache[game] = DailyCache.create(this.type, game)
    }
    return cache[game]
  }


  // 初始化数据
  async initDB (db = false) {
    if (this.db && !db) {
      return
    }
    db = db && db !== true ? db : await MysUserDB.find(this.ltuid, true)
    this.db = db
    this.setCkData(db)
  }

  // 设置ck数据
  setCkData (data = {}) {
    this.ck = data.ck || this.ck || ''
    this.type = data.type || this.type || 'mys'
    this.device = data.device || this.device || MysUtil.getDeviceGuid()
    this.uids = this.uids || {}
    let self = this
    MysUtil.eachGame((game) => {
      self.uids[game] = data?.uids?.[game] || self.uids[game] || []
    })
  }

  async save () {
    await this.db.saveDB(this)
  }

  // 为当前MysUser绑定uid
  addUid (uid, game = 'gs') {
    if (lodash.isArray(uid)) {
      for (let u of uid) {
        this.addUid(u, game)
      }
      return true
    }
    uid = '' + uid
    if (/\d{9}/.test(uid)) {
      let gameKey = this.gameKey(game)
      let uids = this.uids[gameKey]
      if (!uids.includes(uid)) {
        uids.push(uid)
      }
    }
    return true
  }

  hasGame (game = 'gs') {
    game = this.gameKey(game)
    return this.uids[game]?.length > 0
  }

  // 初始化当前MysUser缓存记录
  async initCache () {
    if (!this.ltuid || !this.ck) {
      return
    }
    let self = this
    await MysUtil.eachGame(async (game) => {
      let uids = self.uids[game]
      await this.addQueryUid(uids, game)
      let cache = self.getCache(game)
      let cacheSearchList = await cache.get(tables.del, this.ltuid, true)
      // 这里不直接插入，只插入当前查询记录中没有的值
      if (cacheSearchList && cacheSearchList.length > 0) {
        for (let searchedUid of cacheSearchList) {
          // 检查对应uid是否有新的查询记录
          if (!await this.getQueryLtuid(searchedUid, game)) {
            await this.addQueryUid(searchedUid, game)
          }
        }
      }
    })
    return true
  }

  async disable (game = 'gs') {
    let cache = this.getCache(game)
    await cache.zDel(tables.detail, this.ltuid)
    logger.mark(`[标记无效ck][game:${game}, ltuid:${this.ltuid}`)
  }

  //
  /**
   * 删除缓存, 供User解绑CK时调用
   * @returns {Promise<boolean>}
   */
  async del () {
    // TODO 检查一ltuid多绑定的情况
    // 将查询过的uid缓存起来，以备后续重新绑定时恢复
    let self = this
    await MysUtil.eachGame(async (game) => {
      let uids = await this.getQueryUids(game)
      let cache = self.getCache(game)
      await cache.set(tables.del, uids)
      // 标记ltuid为失效
      await cache.zDel(tables.detail, this.ltuid)
    })
    await self.db.destroy()
    self._delCache()
    logger.mark(`[删除失效ck][ltuid:${this.ltuid}]`)
  }

  // 删除MysUser用户记录，会反向删除User中的记录及绑定关系
  async delWithUser (game = 'gs') {
    // 查找用户
    let cache = this.getCache(game)
    let qqArr = await cache.kGet(tables.qq, this.ltuid, true)
    if (qqArr && qqArr.length > 0) {
      for (let qq of qqArr) {
        let user = await NoteUser.create(qq)
        if (user) {
          // 调用user删除ck
          await user.delCk(this.ltuid, false)
        }
      }
    }
    await this.del()
  }

  // 为当前用户添加uid查询记录
  async addQueryUid (uid, game = 'gs') {
    if (lodash.isArray(uid)) {
      for (let u of uid) {
        await this.addQueryUid(u, game)
      }
      return
    }
    if (uid) {
      let cache = this.getCache(game)
      await cache.zAdd(tables.detail, this.ltuid, uid)
    }
  }

  // 获取当前用户已查询uid列表
  async getQueryUids (game = 'gs') {
    let cache = this.getCache(game)
    return await cache.zList(tables.detail, this.ltuid)
  }

  // 根据uid获取查询ltuid
  async getQueryLtuid (uid, game = 'gs') {
    let cache = this.getCache(game)
    return await cache.zKey(tables.detail, uid)
  }

  // 检查指定uid是否为当前MysUser所有
  ownUid (uid, game = 'gs') {
    if (!uid) {
      return false
    }
    let gameKey = this.gameKey(game)
    let uids = this.uids[gameKey]
    return uids.includes(uid + '')
  }
}
