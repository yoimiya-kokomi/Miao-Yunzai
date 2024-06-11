import md5 from 'md5'
import fetch from 'node-fetch'
import cfg from '../config/config.js'
import apiTool from './apiTool.js'

/**
 *
 */
let HttpsProxyAgent = null

/**
 *
 */
export default class MysApi {
  uid = null
  cookie = null
  isSr = null
  server = null
  apiTool = null

  /**
   * 5分钟缓存
   */
  cacheCd = 300
  /**
   *
   */
  _device = null
  option = null

  /**
   * @param uid 游戏uid
   * @param cookie 米游社cookie
   * @param option 其他参数
   * @param option.log 是否显示日志
   * @param isSr 是否星铁
   * @param device 设备device_id
   */
  constructor(uid, cookie, option = {}, isSr = false, device = '') {
    this.uid = uid
    this.cookie = cookie
    this.isSr = isSr
    this.server = this.getServer()
    this.apiTool = new apiTool(uid, this.server, isSr)
    /** 5分钟缓存 */
    this.cacheCd = 300

    this._device = device
    this.option = {
      log: true,
      ...option
    }
  }

  /* eslint-disable quotes */
  get device() {
    if (!this._device) this._device = `Yz-${md5(this.uid).substring(0, 5)}`
    return this._device
  }

  /**
   *
   * @param type
   * @param data
   * @returns
   */
  getUrl(type, data = {}) {
    const urlMap = this.apiTool.getUrlMap({ ...data, deviceId: this.device })
    if (!urlMap[type]) return false

    let { url, query = '', body = '' } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    const headers = this.getHeaders(query, body)

    return { url, headers, body }
  }

  /**
   *
   * @returns
   */
  getServer() {
    switch (String(this.uid).slice(0, -8)) {
      case '1':
      case '2':
        return this.isSr ? 'prod_gf_cn' : 'cn_gf01' // 官服
      case '5':
        return this.isSr ? 'prod_qd_cn' : 'cn_qd01' // B服
      case '6':
        return this.isSr ? 'prod_official_usa' : 'os_usa' // 美服
      case '7':
        return this.isSr ? 'prod_official_euro' : 'os_euro' // 欧服
      case '8':
      case '18':
        return this.isSr ? 'prod_official_asia' : 'os_asia' // 亚服
      case '9':
        return this.isSr ? 'prod_official_cht' : 'os_cht' // 港澳台服
    }
    return this.isSr ? 'prod_gf_cn' : 'cn_gf01'
  }

  _device_fp = null

  /**
   *
   * @param type
   * @param data
   * @param cached
   * @returns
   */
  async getData(type, data: any = {}, cached = false) {
    if (
      !this._device_fp &&
      !data?.Getfp &&
      !data?.headers?.['x-rpc-device_fp']
    ) {
      this._device_fp = await this.getData('getFp', {
        seed_id: this.generateSeed(16),
        Getfp: true
      })
    }
    if (type === 'getFp' && !data?.Getfp) return this._device_fp

    const UrlData = this.getUrl(type, data)

    if (!UrlData) return false

    let { url, headers, body } = UrlData

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    headers.Cookie = this.cookie

    if (data.headers) {
      headers = { ...headers, ...data.headers }
    }

    if (
      type !== 'getFp' &&
      !headers['x-rpc-device_fp'] &&
      this._device_fp.data?.device_fp
    ) {
      headers['x-rpc-device_fp'] = this._device_fp.data.device_fp
    }

    let param = {
      method: null,
      body: null,
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

    let start = Date.now()

    try {
      const response = await fetch(url, param)
      if (!response.ok) {
        logger.error(
          `[米游社接口][${type}][${this.uid}] ${response.status} ${response.statusText}`
        )
        return false
      }
      if (this.option.log) {
        logger.mark(
          `[米游社接口][${type}][${this.uid}] ${Date.now() - start}ms`
        )
      }
      //
      const data: {
        api?: any
      } = await response.json()
      if (!data) {
        logger.mark('mys接口没有返回')
        return false
      }
      data.api = type
      if (cached) this.cache(data, cacheKey)
      return data
    } catch (error) {
      logger.error(error.toString())
      return false
    }
  }

  /**
   *
   * @param query
   * @param body
   * @returns
   */
  getHeaders(query = '', body = '') {
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
      User_Agent:
        'Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0',
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
      'Referer': client.Referer,
      'DS': this.getDs(query, body),
      'Cookie': null
    }
  }

  /**
   *
   * @param q
   * @param b
   * @returns
   */
  getDs(q = '', b = '') {
    let n = ''
    if (
      ['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)
    ) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (/os_|official/.test(this.server)) {
      n = 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  /**
   *
   * @returns
   */
  getGuid() {
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
  }

  /**
   *
   * @param type
   * @param data
   * @returns
   */
  cacheKey(type, data) {
    return 'Yz:genshin:mys:cache:' + md5(this.uid + type + JSON.stringify(data))
  }

  /**
   *
   * @param res
   * @param cacheKey
   * @returns
   */
  async cache(res, cacheKey) {
    if (!res || res.retcode !== 0) return
    redis.setEx(cacheKey, this.cacheCd, JSON.stringify(res))
  }

  /**
   *
   * @returns
   */
  async getAgent() {
    let proxyAddress = cfg.bot.proxyAddress
    if (!proxyAddress) return null
    if (proxyAddress === 'http://0.0.0.0:0') return null
    if (!/os_|official/.test(this.server)) return null

    //
    if (HttpsProxyAgent == null) {
      const data = await import('https-proxy-agent').catch(err => {
        logger.error(err)
      })
      HttpsProxyAgent = data ? data.HttpsProxyAgent : undefined
    }

    if (HttpsProxyAgent) {
      return new HttpsProxyAgent(proxyAddress)
    }

    return null
  }

  /**
   *
   * @param length
   * @returns
   */
  generateSeed(length = 16) {
    const characters = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)]
    }
    return result
  }
}
