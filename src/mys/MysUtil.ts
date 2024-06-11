import { Data } from '../miao.js'

/**
 *
 */
const games = [
  { key: 'gs', name: '原神' },
  { key: 'sr', name: '星穹铁道' }
]

/**
 *
 */
const MysUtil = {
  /**
   * 获取标准ltuid
   * @param data
   * @returns
   */
  getLtuid(data) {
    if (!data) {
      return false
    }
    if (/^\d{4,10}$/.test(data)) {
      return data
    }
    let testRet = /ltuid=(\d{4,10})/g.exec(data.ck || data)
    if (testRet && testRet[1]) {
      return testRet[1]
    }
    return false
  },

  /**
   * 获取标准gameKey
   * @param game
   * @returns
   */
  getGameKey(game) {
    // 兼容e的处理
    if (game.user_id) {
      return game.isSr ? 'sr' : 'gs'
    }
    return ['sr', 'star'].includes(game) ? 'sr' : 'gs'
  },

  /**
   * 生成设备guid
   * @returns
   */
  getDeviceGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return (
      S4() +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      S4() +
      S4()
    )
  },

  /**
   * 循环game
   * @param fn
   */
  async eachGame(fn) {
    await Data.forEach(games, ds => {
      return fn(ds.key, ds)
    })
  },

  /**
   * 循环server
   * @param fn
   */
  async eachServ(fn) {
    await Data.forEach(['mys', 'hoyolab'], fn)
  }
}

/**
 *
 */
export default MysUtil
