/**
 * 基础类，提供实例缓存等一些基础方法
 */
let cacheMap = {}
let reFn = {}

export default class BaseModel {
  constructor () {
    return this
  }

  // 获取缓存
  _getThis (model, id = '', time = 10 * 60) {
    const uuid = `${model}:${id}`
    if (uuid && cacheMap[uuid]) {
      return cacheMap[uuid]._expire(time)
    }
    this._uuid = uuid
  }

  // 设置缓存
  _cacheThis (time = 10 * 60) {
    let id = this._uuid
    if (id) {
      this._expire(time)
      cacheMap[id] = this
      return cacheMap[id]
    }
    return this
  }

  // 设置超时时间
  _expire (time = 10 * 60) {
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
}
