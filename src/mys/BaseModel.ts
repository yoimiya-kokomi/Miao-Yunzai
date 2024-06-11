/**
 * 基础类，提供实例缓存等一些基础方法
 */
import MysUtil from './MysUtil.js'

/**
 *
 */
const cacheMap = {}

/**
 *
 */
const reFn = {}

/**
 *
 */
export default class BaseModel {
  _uuid = null

  /**
   *
   * @returns
   */
  constructor() {
    /**
     * ????
     */
    return this
  }

  /**
   * 获取缓存
   * @param model
   * @param id
   * @param time
   * @returns
   */
  _getThis(model, id = '', time = 10 * 60) {
    const uuid = `${model}:${id}`
    this._uuid = uuid
    if (uuid && cacheMap[uuid]) {
      return cacheMap[uuid]._expire(time)
    }
  }

  /**
   * 设置缓存
   * @param model
   * @param id
   * @param time
   * @returns
   */
  _cacheThis(model?: any, id?: any, time = 10 * 60) {
    const uuid = this._uuid || `${model}:${id}`
    this._uuid = uuid
    if (uuid) {
      this._expire(time)
      cacheMap[uuid] = this
      return cacheMap[uuid]
    }
    return this
  }

  /**
   * 设置超时时间
   * @param time
   * @returns
   */
  _expire(time = 10 * 60) {
    let id = this._uuid
    reFn[id] && clearTimeout(reFn[id])
    if (time > 0) {
      if (id) {
        reFn[id] = setTimeout(() => {
          reFn[id] && clearTimeout(reFn[id])
          delete reFn[id]
          delete cacheMap[id]
        }, time * 1000)
      }
      return cacheMap[id]
    }
  }

  /**
   *
   */
  _delCache() {
    let id = this._uuid
    reFn[id] && clearTimeout(reFn[id])
    delete reFn[id]
    delete cacheMap[id]
  }

  /**
   *
   * @param game
   * @returns
   */
  gameKey(game = 'gs') {
    return MysUtil.getGameKey(game)
  }

  /**
   *
   * @param game
   * @returns
   */
  isGs(game = 'gs') {
    return this.gameKey(game) === 'gs'
  }

  /**
   *
   * @param game
   * @returns
   */
  isSr(game = 'gs') {
    return this.gameKey(game) === 'sr'
  }
}
