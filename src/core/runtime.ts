import common from '../lib/common/common.js'
import cfg from '../lib/config/config.js'
import Handler from '../lib/plugins/handler.js'

import {
  gsCfg,
  mysApi as MysApi,
  mysInfo as MysInfo,
  NoteUser,
  MysUser
} from '../mys/index.js'

/**
 * ********************
 *  对e进行重构的危险代码
 * ********************
 * tudo
 * 写法混乱，需要重构
 */
export default class Runtime {
  e = null
  _mysInfo = null
  handler = null

  constructor(e) {
    this.e = e
    this._mysInfo = {}

    this.handler = {
      has: Handler.has,
      call: Handler.call,
      callAll: Handler.callAll
    }
  }

  get uid() {
    return this.user?.uid
  }

  get hasCk() {
    return this.user?.hasCk
  }

  get user() {
    return this.e.user
  }

  get cfg() {
    return cfg
  }

  get gsCfg() {
    return gsCfg
  }

  get common() {
    return common
  }

  /**
   * @deprecated 不符合架构设计，已废弃
   */
  get puppeteer() {
    return null
  }

  get MysInfo() {
    return MysInfo
  }

  get NoteUser() {
    return NoteUser
  }

  get MysUser() {
    return MysUser
  }

  /**
   *
   * @param e
   * @returns
   */
  static async init(e) {
    await MysInfo.initCache()
    let runtime = new Runtime(e)
    e.runtime = runtime
    await runtime.initUser()
    return runtime
  }

  /**
   * 初始化
   */
  async initUser() {
    let e = this.e
    let user = await NoteUser.create(e)
    if (user) {
      // 对象代理
      e.user = new Proxy(user, {
        get(self, key, receiver) {
          let game = e.game
          let fnMap = {
            uid: 'getUid',
            uidList: 'getUidList',
            mysUser: 'getMysUser',
            ckUidList: 'getCkUidList'
          }
          if (fnMap[key]) {
            return self[fnMap[key]](game)
          }
          if (key === 'uidData') {
            return self.getUidData('', game)
          }
          // 不能将类型“symbol”分配给类型“string”。
          if (
            [
              'getUid',
              'getUidList',
              'getMysUser',
              'getCkUidList',
              'getUidMapList',
              'getGameDs'
            ].includes(key as string)
          ) {
            return (_game, arg2) => {
              return self[key](_game || game, arg2)
            }
          }
          // 不能将类型“symbol”分配给类型“string”。
          if (
            [
              'getUidData',
              'hasUid',
              'addRegUid',
              'delRegUid',
              'setMainUid'
            ].includes(key as string)
          ) {
            return (uid, _game = '') => {
              return self[key](uid, _game || game)
            }
          }
          return self[key]
        }
      })
    }
  }

  /**
   * 获取MysInfo实例
   *
   * @param targetType all: 所有用户均可， cookie：查询用户必须具备Cookie
   * @returns {Promise<boolean|MysInfo>}
   */
  async getMysInfo(targetType = 'all') {
    if (!this._mysInfo[targetType]) {
      this._mysInfo[targetType] = await MysInfo.init(
        this.e,
        targetType === 'cookie' ? 'detail' : 'roleIndex'
      )
    }
    return this._mysInfo[targetType]
  }

  /**
   *
   * @returns
   */
  async getUid() {
    return await MysInfo.getUid(this.e)
  }

  /**
   * 获取MysApi实例
   *
   * @param targetType all: 所有用户均可， cookie：查询用户必须具备Cookie
   * @param option MysApi option
   * @param isSr 是否为星穹铁道
   * @returns {Promise<boolean|MysApi>}
   */
  async getMysApi(targetType = 'all', option = {}, isSr = false) {
    let mys = await this.getMysInfo(targetType)
    if (mys.uid && mys?.ckInfo?.ck) {
      return new MysApi(mys.uid, mys.ckInfo.ck, option, isSr)
    }
    return false
  }

  /**
   * 生成MysApi实例
   * @param uid
   * @param ck
   * @param option
   * @param isSr 是否为星穹铁道
   * @returns {Promise<MysApi>}
   */
  async createMysApi(uid, ck, option, isSr = false) {
    return new MysApi(uid, ck, option, isSr)
  }

  /**
   * @deprecated 不符合架构设计，已废弃
   */
  async render(plugin, path, data = {}, cfg = {}) {
    return false
  }
}
