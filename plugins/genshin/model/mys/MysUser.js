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
import lodash from 'lodash'
import fetch from 'node-fetch'

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
  constructor (data) {
    super()
    let ltuid = data.ltuid
    if (!ltuid) {
      return false
    }
    // 检查实例缓存
    let self = this._getThis('mys', ltuid)
    if (!self) {
      self = this
    }
    // 单日有效缓存，不区分服务器
    self.cache = self.cache || DailyCache.create()
    self.uids = self.uids || []
    self.ltuid = data.ltuid
    self.ck = self.ck || data.ck
    self.qq = self.qq || data.qq || 'pub'
    if (data.uid || data.uids) {
      self.addUid(data.uid || data.uids)
    }
    if (data.ck && data.ltuid) {
      self.ckData = data
    }
    // 单日有效缓存，使用uid区分不同服务器
    self.servCache = self.servCache || DailyCache.create(self.uids[0] || 'mys')
    return self._cacheThis()
  }

  // 可传入ltuid、cookie、ck对象来创建MysUser实例
  // 在仅传入ltuid时，必须是之前传入过的才能被识别
  static async create (data) {
    if (!data) {
      return false
    }
    if (lodash.isPlainObject(data)) {
      return new MysUser(data)
    }
    // 传入cookie
    let testRet = /ltuid=(\d{4,9})/g.exec(data)
    if (testRet && testRet[1]) {
      let ltuid = testRet[1]
      // 尝试使用ltuid创建
      let ckUser = await MysUser.create(ltuid)
      if (ckUser) {
        return ckUser
      }
      let uids = await MysUser.getCkUid(data)
      if (uids) {
        return new MysUser({
          ltuid,
          ck: data,
          type: 'ck',
          uids
        })
      }
    }
    // 传入ltuid
    if (/^\d{4,9}$/.test(data)) {
      // 查找ck记录
      let cache = DailyCache.create()
      let ckData = await cache.kGet(tables.ck, data, true)
      if (ckData && ckData.ltuid) {
        return new MysUser(ckData)
      }
    }
    return false
  }

  // 根据uid获取查询MysUser
  static async getByQueryUid (uid, onlySelfCk = false) {
    let servCache = DailyCache.create(uid)
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
      if (onlySelfCk && !await ckUser.ownUid(uid)) {
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

  // 为当前MysUser绑定uid
  addUid (uid) {
    if (lodash.isArray(uid)) {
      for (let u of uid) {
        this.addUid(u)
      }
      return true
    }
    uid = '' + uid
    if (/\d{9}/.test(uid) || uid === 'pub') {
      if (!this.uids.includes(uid)) {
        this.uids.push(uid)
      }
    }
    return true
  }

  // 初始化当前MysUser缓存记录
  async initCache (user) {
    if (!this.ltuid || !this.servCache || !this.ck) {
      return
    }

    // 为当前MysUser添加uid查询记录
    if (!lodash.isEmpty(this.uids)) {
      for (let uid of this.uids) {
        if (uid !== 'pub') {
          await this.addQueryUid(uid)
          // 添加ltuid-uid记录，用于判定ltuid绑定个数及自ltuid查询
          await this.cache.zAdd(tables.uid, this.ltuid, uid)
        }
      }
    } else {
      console.log(`ltuid:${this.ltuid}暂无uid信息，请检查...`)
      // 公共ck暂无uid信息不添加
      if (user?.qq === 'pub') {
        return false
      }
    }
    // 缓存ckData，供后续缓存使用
    // ltuid关系存储到与server无关的cache中，方便后续检索
    if (this.ckData && this.ckData.ck) {
      await this.cache.kSet(tables.ck, this.ltuid, this.ckData)
    }

    // 缓存qq，用于删除ltuid时查找
    if (user && user.qq) {
      let qq = user.qq === 'pub' ? 'pub' : user.qq * 1
      let qqArr = await this.cache.kGet(tables.qq, this.ltuid, true)
      if (!lodash.isArray(qqArr)) {
        qqArr = []
      }
      if (!qqArr.includes(qq)) {
        qqArr.push(qq)
        await this.cache.kSet(tables.qq, this.ltuid, qqArr)
      }
    }

    // 从删除记录中查找并恢复查询记录
    let cacheSearchList = await this.servCache.get(tables.del, this.ltuid, true)
    // 这里不直接插入，只插入当前查询记录中没有的值
    if (cacheSearchList && cacheSearchList.length > 0) {
      for (let searchedUid of cacheSearchList) {
        // 检查对应uid是否有新的查询记录
        if (!await this.getQueryLtuid(searchedUid)) {
          await this.addQueryUid(searchedUid)
        }
      }
    }
    return true
  }

  static async eachServ (fn) {
    let servs = ['mys', 'hoyolab']
    for (let serv of servs) {
      let servCache = DailyCache.create(serv)
      await fn(servCache, serv)
    }
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

  async disable () {
    await this.servCache.zDel(tables.detail, this.ltuid)
    logger.mark(`[标记无效ck][ltuid:${this.ltuid}]`)
  }

  //
  //
  /**
   * 删除缓存, 供User解绑CK时调用
   * @param user
   * @returns {Promise<boolean>}
   */
  async del (user) {
    if (user && user.qq) {
      let qqList = await this.cache.kGet(tables.qq, this.ltuid, true)
      let newList = lodash.pull(qqList, user.qq * 1)
      await this.cache.kSet(tables.qq, this.ltuid, newList)
      if (newList.length > 0) {
        // 如果数组还有其他元素，说明该ltuid还有其他绑定，不进行缓存删除
        return false
      }
    }
    // 将查询过的uid缓存起来，以备后续重新绑定时恢复
    let uids = await this.getQueryUids()
    await this.servCache.set(tables.del, uids)

    // 标记ltuid为失效
    await this.servCache.zDel(tables.detail, this.ltuid)
    await this.cache.zDel(tables.uid, this.ltuid)
    await this.cache.kDel(tables.ck, this.ltuid)
    await this.cache.kDel(tables.qq, this.ltuid)
    logger.mark(`[删除失效ck][ltuid:${this.ltuid}]`)
  }

  // 删除MysUser用户记录，会反向删除User中的记录及绑定关系
  async delWithUser () {
    // 查找用户
    let qqArr = await this.cache.kGet(tables.qq, this.ltuid, true)
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
  async addQueryUid (uid) {
    if (uid) {
      await this.servCache.zAdd(tables.detail, this.ltuid, uid)
    }
  }

  // 获取当前用户已查询uid列表
  async getQueryUids () {
    return await this.servCache.zList(tables.detail, this.ltuid)
  }

  // 根据uid获取查询ltuid
  async getQueryLtuid (uid) {
    return await this.servCache.zKey(tables.detail, uid)
  }

  // 检查指定uid是否为当前MysUser所有
  async ownUid (uid) {
    if (!uid) {
      return false
    }
    let uidArr = await this.cache.zList(tables.uid, this.ltuid) || []
    return uid && uidArr.join(',').split(',').includes(uid + '')
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
      console.log('cks', cks)
      for (let ck of cks) {
        if (await servCache.zDel(tables.detail, ck, true)) {
          count++
        }
        let ckUser = await MysUser.create(ck)
        console.log('ckUser', ck, ckUser)
        if (ckUser) {
          await ckUser.delWithUser()
        }
      }
    })
    return count
  }

  static async getGameRole (ck, serv = 'mys') {
    let url = {
      mys: 'https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn',
      hoyolab: 'https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_global'
    }

    let res = await fetch(url[serv], { method: 'get', headers: { Cookie: ck } })
    if (!res.ok) return false
    res = await res.json()

    return res
  }

  // 获取米游社通行证id
  static async getUserFullInfo (ck, serv = 'mys') {
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

  /**
   * 获取ck对应uid列表
   * @param ck 需要获取的ck
   * @param withMsg false:uids / true: {uids, msg}
   * @param force 忽略缓存，强制更新
   * @returns {Promise<{msg: *, uids}>}
   */
  static async getCkUid (ck, withMsg = false, force = false) {
    let ltuid = ''
    let testRet = /ltuid=(\w{0,9})/g.exec(ck)
    if (testRet && testRet[1]) {
      ltuid = testRet[1]
    }
    let uids = []
    let ret = (msg, retUid) => {
      retUid = lodash.map(retUid, (a) => a + '')
      return withMsg ? { msg, uids: retUid } : retUid
    }
    if (!ltuid) {
      return ret('无ltuid', false)
    }

    if (!force) {
      // 此处不使用DailyCache，做长期存储
      uids = await redis.get(`Yz:genshin:mys:ltuid-uids:${ltuid}`)
      if (uids) {
        uids = DailyCache.decodeValue(uids, true)
        if (uids && uids.length > 0) {
          return ret('', uids)
        }
      }
    }

    uids = []
    let res = null
    let msg = 'error'
    for (let serv of ['mys', 'hoyolab']) {
      let roleRes = await MysUser.getGameRole(ck, serv)
      if (roleRes?.retcode === 0) {
        res = roleRes
        break
      }
      if (roleRes.retcode * 1 === -100) {
        msg = '该ck已失效，请重新登录获取'
      }
      msg = roleRes.message || 'error'
    }
    if (!res) return ret(msg, false)
    if (!res.data.list || res.data.list.length <= 0) {
      return ret('该账号尚未绑定原神角色', false)
    }

    for (let val of res.data.list) {
      if (/\d{9}/.test(val.game_uid)) {
        uids.push(val.game_uid + '')
      }
    }
    if (uids.length > 0) {
      await redis.set(`Yz:genshin:mys:ltuid-uids:${ltuid}`, JSON.stringify(uids), { EX: 3600 * 24 * 90 })
      return ret('', uids)
    }
    return ret(msg, false)
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
}
