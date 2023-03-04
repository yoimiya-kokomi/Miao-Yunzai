import moment from 'moment'
import BaseModel from './BaseModel.js'

const servs = ['mys', 'hoyolab']
// 超时时间不必精确，直接定24小时即可
const EX = 3600 * 24
const redisKeyRoot = 'Yz:genshin:mys:'

export default class DailyCache extends BaseModel {
  constructor (uid) {
    super()
    const storeKey = DailyCache.getStoreKey(uid)
    // 检查实例缓存
    let self = this._getThis('store', storeKey)
    if (self) {
      return self
    }
    this.keyPre = `${redisKeyRoot}${storeKey}`
    return this._cacheThis()
  }

  /**
   * 传入UID或server标示，返回当日存储对象
   * @param uid
   * * 为空则返回与serv无关的dailyCache
   * * 传入UID，会返回UID对应serv的cache对象
   * * 传入servKey (mys/hoyolab)，会返回指定的servCache
   * @returns {DailyCache}
   */
  static create (uid) {
    return new DailyCache(uid)
  }

  /** ---- 基础方法 ---- **/
  // 内部方法：获取redis表key键值
  getTableKey (key, sub = '') {
    if (sub) {
      return `${this.keyPre}:${key}-${sub}`
    } else {
      return `${this.keyPre}:${key}`
    }
  }

  // 内部方法：获取server key
  static getServKey (uid) {
    // 不传入uid为默认cache
    if (!uid || uid === 'cache') {
      return 'cache'
    }
    // 传入uid或sever key，判断是mys还是hoyolab
    return /^[6-9]|^hoyo|^os/i.test(uid) ? servs[1] : servs[0]
  }

  // 内部方法：获取redis表前缀
  static getStoreKey (uid) {
    const serv = DailyCache.getServKey(uid)
    const date = moment().format('MM-DD')
    return `${serv}-${date}`
  }

  /**
   * 遍历所有servCache
   * @param fn
   * @returns {Promise<void>}
   */
  static async eachCache (fn) {
    for (const serv of servs) {
      let cache = DailyCache.create(serv)
      if (cache) {
        await fn(cache)
      }
    }
  }

  /**
   * 删除过期的DailyCache
   */
  static async clearOutdatedData () {
    let keys = await redis.keys(`${redisKeyRoot}*`)
    const date = moment().format('MM-DD')
    const testReg = new RegExp(`^${redisKeyRoot}(mys|hoyo|hoyolab|cache)-\\d{2}-\\d{2}`)
    const todayReg = new RegExp(`^${redisKeyRoot}(mys|hoyo|hoyolab|cache)-${date}`)
    for (let key of keys) {
      if (testReg.test(key) && !todayReg.test(key)) {
        await redis.del(key)
      }
    }
  }

  /**
   * 设置指定表的过期时间
   * @param table 表
   * @param hasCount 是否具有count表（KeyList）
   * @returns {Promise<void>}
   */
  async exTable (table, hasCount = false) {
    await redis.expire(this.getTableKey(table), EX)
    if (hasCount) {
      await redis.expire(this.getTableKey(table, 'count'), EX)
    }
  }

  /**
   * 清空删除指定表
   * @param table
   * @returns {Promise<void>}
   */
  async empty (table) {
    await redis.del(this.getTableKey(table))
    await redis.del(this.getTableKey(table, 'count'))
  }

  /**
   * 【基础数据结构】：Key-Value
   *
   * 每个key对应一个Value
   * 使用redis kv存储,所有操作需要指定表名
   *
   * **/

  /**
   * 获取表指定key内容
   * @param table 表名
   * @param key 数据存储key
   * @param decode 是否对内容进行decode
   * @returns {Promise<any|boolean>}
   */
  async kGet (table, key, decode = false) {
    let value = await redis.hGet(this.getTableKey(table), '' + key)
    return DailyCache.decodeValue(value, decode)
  }

  /**
   * 设置表指定key内容
   * @param table 表名
   * @param key 数据存储key
   * @param value 数据，若传入对象或数组会自动encode
   * @returns {Promise<void>}
   */
  async kSet (table, key, value) {
    value = DailyCache.encodeValue(value)
    await redis.hSet(this.getTableKey(table), '' + key, value)
    await this.exTable(this.getTableKey(table))
  }

  /**
   * 删除表中指定key内容
   * @param table 表名
   * @param key 数据存储key
   * @returns {Promise<number>}
   */
  async kDel (table, key) {
    return await redis.hDel(this.getTableKey(table), '' + key)
  }

  /**
   * 获取指定表内容
   * @param table 表名
   * @param decode 是否对内容进行decode
   * @returns {Promise<any|boolean>}
   */
  async get (table, decode = false) {
    const tableKey = this.getTableKey(table)
    let value = await redis.get(tableKey)
    return DailyCache.decodeValue(value, decode)
  }

  /**
   * 设置指定表内容
   * @param table 表名
   * @param value 数据，若传入对象或数组会自动encode
   * @returns {Promise<any|boolean>}
   */
  async set (table, value) {
    value = DailyCache.encodeValue(value)
    return await redis.set(this.getTableKey(table), value, { EX })
  }

  // 内部方法，用于decode value
  static decodeValue (value, decode = false) {
    if (value && decode) {
      try {
        return JSON.parse(value)
      } catch (e) {
        return false
      }
    }
    return value
  }

  // 内部方法，用于encode value
  static encodeValue (value) {
    if (typeof (value) === 'object') {
      return JSON.stringify(value) || ''
    }
    if (typeof (value) === 'undefined') {
      return ''
    }
    return '' + value
  }

  /**
   * 【基础数据结构】：Key-List
   *
   * 每个key对应一个list，key必须为数字，list间的item不重复
   * 若重复item被添加，则会将item移至指定key对应List中
   *
   * 会自动统计每个list长度并排序
   * 使用redis sorted map存储，所有操作需要指定表名
   *
   * **/

  /**
   * 为KeyList添加 item
   * @param table 表名
   * @param key 添加item对应 key键值
   * @param item 添加的item
   * @returns {Promise<void>}
   */
  async zAdd (table, key, item) {
    const tableKey = this.getTableKey(table)
    await redis.zAdd(tableKey, { score: key, value: item + '' })

    // 同时更新数量，用于数量统计
    let count = await this.zCount(table, key) || 0
    const countKey = this.getTableKey(table, 'count')
    await redis.zAdd(countKey, { score: count, value: key + '' })
    await this.exTable(this.getTableKey(table), true)
  }

  // 根据key获取list
  /**
   * 根据Key获取List
   * @param table 表名
   * @param key key键值
   * @returns {Promise<Array<ConvertArgumentType<string | Buffer, string>>>}
   */
  async zList (table, key) {
    return await redis.zRangeByScore(this.getTableKey(table), key, key)
  }

  /**
   * 获取指定item所在List对应的key键值
   * @param table 表名
   * @param item item
   * @returns {Promise<number>}
   */
  async zKey (table, item) {
    return await redis.zScore(this.getTableKey(table), item + '')
  }

  /**
   * 获取指定key对应List的长度
   * @param table 表名
   * @param key 需要获取长度的key
   * @returns {Promise<number>} 长度值
   */
  async zCount (table, key) {
    return await redis.zCount(this.getTableKey(table), key, key)
  }

  /**
   * 获取当前KeyList中，List长度最小的一个key
   * 由于内部场景使用，简单规定List长度有效范围为0-60
   * @param table
   * @returns {Promise<string>}
   */
  async zMinKey (table) {
    let keys = await redis.zRangeByScore(this.getTableKey(table, 'count'), 0, 60)
    return keys[0]
  }

  /**
   * 在当前KeyList中禁用指定的key
   * 会保留所有已有item记录，但不再被zMinKey识别并返回
   * 主要用于标记CK查询次数超限场景（已经查询的记录仍然有效）
   * @param table
   * @param key
   * @param delCount 是否同时删除count记录，删除后不会被zGetDisableKey获取
   * @returns {Promise<void>}
   */
  async zDisableKey (table, key, delCount = false) {
    // 将count标记为99次，记录并防止被后续分配
    const countKey = this.getTableKey(table, 'count')
    if (delCount) {
      await redis.zRem(countKey, key)
    } else {
      await redis.zAdd(countKey, { score: 99, value: key })
    }
  }

  /**
   * 获取已禁用的key列表，用于主动清除数据使用
   * @param table
   * @returns {Promise<Array<ConvertArgumentType<string | Buffer, string>>>}
   */
  async zGetDisableKey (table) {
    return await redis.zRangeByScore(this.getTableKey(table, 'count'), 99, 99)
  }

  // 删除某个key
  // 清空所有查询关联，同时不再被zMinKey识别并返回
  /**
   * 删除指定key记录
   * 清空所有查询关联，同时不再被zMinKey识别并返回
   * 与zDisableKey的区别在于会删除detail中已存在的记录
   * 主要用于CK失效场景（已经查询的记录也同时失效）
   * @param table
   * @param key
   * @param delCount 是否同时删除count记录，删除后不会被zGetDisableKey获取
   * @returns {Promise<boolean>}
   */
  async zDel (table, key, delCount = false) {
    // 删除key对应list所有记录
    let check = redis.zScore(this.getTableKey(table, 'count'), key)
    await redis.zRemRangeByScore(this.getTableKey(table), key, key)
    await this.zDisableKey(table, key, delCount)
    return !!check
  }

  /**
   * 获取指定表格的key:List count 统计数据
   * @param table
   * @returns {Promise<{key:count}>}
   */
  async zStat (table) {
    const countKey = this.getTableKey(table, 'count')
    return await redis.zRangeByScoreWithScores(countKey, 0, 100)
  }
}
