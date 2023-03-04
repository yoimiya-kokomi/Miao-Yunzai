import md5 from 'md5'
import lodash from 'lodash'
import fetch from 'node-fetch'
import cfg from '../../../../lib/config/config.js'

let HttpsProxyAgent = ''

export default class MysApi {
  /**
   * @param uid 游戏uid
   * @param cookie 米游社cookie
   * @param option 其他参数
   * @param option.log 是否显示日志
   */
  constructor (uid, cookie, option = {}) {
    this.uid = uid
    this.cookie = cookie
    this.server = this.getServer()

    /** 5分钟缓存 */
    this.cacheCd = 300

    this.option = {
      log: true,
      ...option
    }
  }

  getUrl (type, data = {}) {
    let host, hostRecord
    if (['cn_gf01', 'cn_qd01'].includes(this.server)) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
      host = 'https://api-os-takumi.mihoyo.com/'
      hostRecord = 'https://bbs-api-os.mihoyo.com/'
    }

    let urlMap = {
      /** 首页宝箱 */
      index: {
        url: `${hostRecord}game_record/app/genshin/api/index`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      /** 深渊 */
      spiralAbyss: {
        url: `${hostRecord}game_record/app/genshin/api/spiralAbyss`,
        query: `role_id=${this.uid}&schedule_type=${data.schedule_type || 1}&server=${this.server}`
      },
      /** 角色详情 */
      character: {
        url: `${hostRecord}game_record/app/genshin/api/character`,
        body: { role_id: this.uid, server: this.server }
      },
      /** 树脂 */
      dailyNote: {
        url: `${hostRecord}game_record/app/genshin/api/dailyNote`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      /** 详情 */
      detail: {
        url: `${host}event/e20200928calculate/v1/sync/avatar/detail`,
        query: `uid=${this.uid}&region=${this.server}&avatar_id=${data.avatar_id}`
      },
      /** 札记 */
      ys_ledger: {
        url: 'https://hk4e-api.mihoyo.com/event/ys_ledger/monthInfo',
        query: `month=${data.month}&bind_uid=${this.uid}&bind_region=${this.server}`
      },
      /** 养成计算器 */
      compute: {
        url: `${host}event/e20200928calculate/v2/compute`,
        body: data
      },
      blueprintCompute: {
        url: `${host}event/e20200928calculate/v1/furniture/compute`,
        body: data
      },
      /** 养成计算器 */
      blueprint: {
        url: `${host}event/e20200928calculate/v1/furniture/blueprint`,
        query: `share_code=${data.share_code}&region=${this.server}`
      },
      /** 角色技能 */
      avatarSkill: {
        url: `${host}event/e20200928calculate/v1/avatarSkill/list`,
        query: `avatar_id=${data.avatar_id}`
      },
      createVerification: {
        url: `${hostRecord}game_record/app/card/wapi/createVerification`,
        query: 'is_high=true'
      },
      verifyVerification: {
        url: `${hostRecord}game_record/app/card/wapi/verifyVerification`,
        body: data
      },
      /** 七圣召唤数据 */
      basicInfo: {
        url: `${hostRecord}game_record/app/genshin/api/gcg/basicInfo`,
        query: `role_id=${this.uid}&server=${this.server}`
      },
      /**使用兑换码 目前仅限国际服,来自于国服的uid请求已在myinfo.js的init方法提前拦截 */
      useCdk: {
        url:'PLACE_HOLDER',
        query: null
      }
    }
    if (this.server.startsWith('os')) {
      urlMap.detail.url = 'https://sg-public-api.hoyolab.com/event/calculateos/sync/avatar/detail'// 角色天赋详情
      urlMap.detail.query = `lang=zh-cn&uid=${this.uid}&region=${this.server}&avatar_id=${data.avatar_id}`

      urlMap.avatarSkill.url = 'https://sg-public-api.hoyolab.com/event/calculateos/avatar/skill_list'// 查询未持有的角色天赋
      urlMap.avatarSkill.query = `lang=zh-cn&avatar_id=${data.avatar_id}`

      urlMap.compute.url = 'https://sg-public-api.hoyolab.com/event/calculateos/compute'// 已支持养成计算

      urlMap.blueprint.url = 'https://sg-public-api.hoyolab.com/event/calculateos/furniture/blueprint'
      urlMap.blueprint.query = `share_code=${data.share_code}&region=${this.server}&lang=zh-cn`

      urlMap.blueprintCompute.url = 'https://sg-public-api.hoyolab.com/event/calculateos/furniture/compute'
      urlMap.blueprintCompute.body = { lang: 'zh-cn', ...data }

      urlMap.ys_ledger.url = 'https://hk4e-api-os.mihoyo.com/event/ysledgeros/month_info'// 支持了国际服札记
      urlMap.ys_ledger.query = `lang=zh-cn&month=${data.month}&uid=${this.uid}&region=${this.server}`

      urlMap.useCdk.url = 'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey'
      urlMap.useCdk.query = `uid=${this.uid}&region=${this.server}&lang=zh-cn&cdkey=${data.cdk}&game_biz=hk4e_global`
    }

    if (!urlMap[type]) return false

    let { url, query = '', body = '', sign = '' } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body, sign)

    return { url, headers, body }
  }

  getServer () {
    let uid = this.uid
    switch (String(uid)[0]) {
      case '1':
      case '2':
        return 'cn_gf01' // 官服
      case '5':
        return 'cn_qd01' // B服
      case '6':
        return 'os_usa' // 美服
      case '7':
        return 'os_euro' // 欧服
      case '8':
        return 'os_asia' // 亚服
      case '9':
        return 'os_cht' // 港澳台服
    }
    return 'cn_gf01'
  }

  async getData (type, data = {}, cached = false) {
    let { url, headers, body } = this.getUrl(type, data)

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    headers.Cookie = this.cookie

    if (data.headers) {
      headers = { ...headers, ...data.headers }
      delete data.headers
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

    if (res.retcode !== 0 && this.option.log) {
      logger.debug(`[米游社接口][请求参数] ${url} ${JSON.stringify(param)}`)
    }

    res.api = type

    if (cached) this.cache(res, cacheKey)

    return res
  }

  getHeaders (query = '', body = '') {
    const cn = {
      app_version: '2.37.1',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBS/2.37.1`,
      client_type: 5,
      Origin: 'https://webstatic.mihoyo.com',
      X_Requested_With: 'com.mihoyo.hyperion',
      Referer: 'https://webstatic.mihoyo.com'
    }
    const os = {
      app_version: '2.9.0',
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBSOversea/2.9.0`,
      client_type: '2',
      Origin: 'https://webstatic-sea.hoyolab.com',
      X_Requested_With: 'com.mihoyo.hoyolab',
      Referer: 'https://webstatic-sea.hoyolab.com'
    }
    let client
    if (this.server.startsWith('os')) {
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
    if (['cn_gf01', 'cn_qd01'].includes(this.server)) {
      n = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'
    } else if (['os_usa', 'os_euro', 'os_asia', 'os_cht'].includes(this.server)) {
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

  /* eslint-disable quotes */
  get device () {
    if (!this._device) this._device = `Yz-${md5(this.uid).substring(0, 5)}`
    return this._device
  }

  async getAgent () {
    let proxyAddress = cfg.bot.proxyAddress
    if (!proxyAddress) return null
    if (proxyAddress === 'http://0.0.0.0:0') return null

    if (!this.server.startsWith('os')) return null

    if (HttpsProxyAgent === '') {
      HttpsProxyAgent = await import('https-proxy-agent').catch((err) => {
        logger.error(err)
      })

      HttpsProxyAgent = HttpsProxyAgent ? HttpsProxyAgent.default : undefined
    }

    if (HttpsProxyAgent) {
      return new HttpsProxyAgent(proxyAddress)
    }

    return null
  }
}
