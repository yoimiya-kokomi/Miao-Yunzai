import md5 from 'md5'
import fetch from 'node-fetch'
import cfg from '../../../../lib/config/config.js'
import ApiTool from './apiTool.js'

let HttpsProxyAgent = ''
export default class MysApi {
  /**
   * @param uid 游戏uid
   * @param cookie 米游社cookie
   * @param option 其他参数
   * @param option 其他参数
   * @param option.log 是否显示日志
   */
  constructor (uid, cookie, option = { game: 'gs', device: '' }) {
    this.uid = uid
    this.cookie = cookie
    this.game = option.game || 'gs'
    this.isSr = this.game === 'sr'
    this.server = this.getServer(uid, this.game)
    this.apiTool = new ApiTool(uid, this.server, this.game)
    /** 5分钟缓存 */
    this.cacheCd = 300

    this._device = option.device || this.device
    this.option = {
      log: true,
      ...option
    }
  }

  /* eslint-disable quotes */
  get device () {
    if (!this._device) this._device = `Yz-${md5(this.uid).substring(0, 5)}`
    return this._device
  }

  getUrl (type, data = {}) {
    let urlMap = this.apiTool.getUrlMap({ ...data, deviceId: this.device })
    if (!urlMap[type]) return false

    let { url, query = '', body = '' } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)

    return { url, headers, body }
  }

  getServer (uid, game = 'gs') {
    let server = {
      gs: {
        1: 'cn_gf01',
        2: 'cn_gf01',
        3: 'cn_gf01',
        5: 'cn_qd01',
        6: 'os_usa',
        7: 'os_euro',
        8: 'os_asia',
        18: 'os_asia',
        9: 'os_cht'
      },
      sr: {
        1: 'prod_gf_cn',
        2: 'prod_gf_cn',
        5: 'prod_qd_cn',
        6: 'prod_official_usa',
        7: 'prod_official_euro',
        8: 'prod_official_asia',
        9: 'prod_official_cht'
      },
      zzz: {
        1: 'prod_gf_cn',
        2: 'prod_gf_cn',
        5: 'prod_qd_cn',
        10: 'prod_gf_us',
        13: 'prod_gf_jp',
        15: 'prod_gf_eu',
        17: 'prod_gf_sg'
      }
    }

    uid = String(uid).slice(0, game === 'zzz' ? -7 : -8)
    server = server[game]
    return server[uid] ?? server[1]
  }

  async getData (type, data = {}, cached = false) {
    if (!this._device_fp && !data?.Getfp && !data?.headers?.['x-rpc-device_fp']) {
      this._device_fp = await this.getData('getFp', {
        seed_id: this.generateSeed(16),
        Getfp: true
      })
    }
    if (type === 'getFp' && !data?.Getfp) return this._device_fp

    let { url, headers, body } = this.getUrl(type, data)

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    headers.Cookie = this.cookie

    if (data.headers) {
      headers = { ...headers, ...data.headers }
    }

    if (type !== 'getFp' && !headers['x-rpc-device_fp'] && this._device_fp.data?.device_fp) {
      headers['x-rpc-device_fp'] = this._device_fp.data.device_fp
    }

    let param = {
      headers,
      agent: await this.getAgent(),
      timeout: 10000
    }
    if (body) {
      param.method = 'post'
      param.body = body
    } else {
      param.method = 'get'
    }
    let response = {}
    let start = Date.now()
    try {
      response = await fetch(url, param)
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[米游社接口][${type}][${this.uid}] ${response.status} ${response.statusText}`)
      return false
    }
    if (this.option.log) {
      logger.mark(`[米游社接口][${type}][${this.uid}] ${Date.now() - start}ms`)
    }
    const res = await response.json()

    if (!res) {
      logger.mark('mys接口没有返回')
      return false
    }

    res.api = type

    if (cached) this.cache(res, cacheKey)

    return res
  }

  getHeaders (query = '', body = '') {
    const cn = {
      app_version: '2.40.1',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBS/2.40.1`,
      client_type: '5',
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com/'
    }
    const os = {
      app_version: '2.55.0',
      User_Agent: 'Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0',
      client_type: '2',
      Origin: 'https://act.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://act.hoyolab.com/'
    }
    let client
    if (/os_|official/.test(this.server)) {
      client = os
    } else {
      client = cn
    }
    return {
      'x-rpc-app_version': client.app_version,
      'x-rpc-client_type': client.client_type,
      'User-Agent': client.User_Agent,
      Referer: client.Referer,
      DS: this.getDs(query, body)
    }
  }

  getDs (q = '', b = '') {
    let n = ''
    if (['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (/os_|official/.test(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getGuid () {
    function S4 () {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4())
  }

  cacheKey (type, data) {
    return 'Yz:genshin:mys:cache:' + md5(this.uid + type + JSON.stringify(data))
  }

  async cache (res, cacheKey) {
    if (!res || res.retcode !== 0) return
    redis.setEx(cacheKey, this.cacheCd, JSON.stringify(res))
  }

  async getAgent () {
    let proxyAddress = cfg.bot.proxyAddress
    if (!proxyAddress) return null
    if (proxyAddress === 'http://0.0.0.0:0') return null

    if (!/os_|official/.test(this.server)) return null

    if (HttpsProxyAgent === '') {
      HttpsProxyAgent = await import('https-proxy-agent').catch((err) => {
        logger.error(err)
      })

      HttpsProxyAgent = HttpsProxyAgent ? HttpsProxyAgent.HttpsProxyAgent : undefined
    }

    if (HttpsProxyAgent) {
      return new HttpsProxyAgent(proxyAddress)
    }

    return null
  }

  generateSeed (length = 16) {
    const characters = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)]
    }
    return result
  }
}

export function randomRange () {
  let randomStr = ''
  let charStr = 'abcdef0123456789'
  for (let i = 0; i < 64; i++) {
    let index = Math.round(Math.random() * (charStr.length - 1))
    randomStr += charStr.substring(index, index + 1)
  }
  return randomStr
}
