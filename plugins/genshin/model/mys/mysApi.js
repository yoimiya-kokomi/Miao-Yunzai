import md5 from "md5"
import fetch from "node-fetch"
import cfg from "../../../../lib/config/config.js"
import ApiTool from "./apiTool.js"

const game_region = {
  gs: ["cn_gf01", "cn_qd01", "os_usa", "os_euro", "os_asia", "os_cht"],
  sr: [
    "prod_gf_cn",
    "prod_qd_cn",
    "prod_official_usa",
    "prod_official_euro",
    "prod_official_asia",
    "prod_official_cht",
  ],
  zzz: ["prod_gf_cn", "prod_gf_cn", "prod_gf_us", "prod_gf_eu", "prod_gf_jp", "prod_gf_sg"],
}

let HttpsProxyAgent = ""
export default class MysApi {
  /**
   * @param uid 游戏uid
   * @param cookie 米游社cookie
   * @param option 其他参数
   * @param option.log 是否显示日志
   * @param isSr 是否星铁
   * @param device 设备device_id
   */
  constructor(uid, cookie, option = { game: "gs", device: "" }) {
    this.uid = uid
    this.cookie = cookie
    this.game = option.game || "gs"
    this.server = this.getServer(uid, this.game)
    this.apiTool = new ApiTool(uid, this.server, this.game)
    /** 5分钟缓存 */
    this.cacheCd = 300

    this._device = option.device || this.device
    this.option = {
      log: true,
      ...option,
    }
  }

  /* eslint-disable quotes */
  get device() {
    if (!this._device) this._device = `Yz-${md5(this.uid).substring(0, 5)}`
    return this._device
  }

  getUrl(type, data = {}) {
    let urlMap = this.apiTool.getUrlMap({ ...data, deviceId: this.device })
    if (!urlMap[type]) return false

    let { url, query = "", body = "" } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders(query, body)

    return { url, headers, body }
  }

  getServer() {
    const _uid = String(this.uid)
    if (this.game == "zzz") {
      if (_uid.length < 10) {
        return game_region[this.game][0] // 官服
      }

      switch (_uid.slice(0, -8)) {
        case "10":
          return game_region[this.game][2] // 美服
        case "15":
          return game_region[this.game][3] // 欧服
        case "13":
          return game_region[this.game][4] // 亚服
        case "17":
          return game_region[this.game][5] // 港澳台服
      }
    } else {
      switch (_uid.slice(0, -8)) {
        case "5":
          return game_region[this.game][1] // B服
        case "6":
          return game_region[this.game][2] // 美服
        case "7":
          return game_region[this.game][3] // 欧服
        case "8":
        case "18":
          return game_region[this.game][4] // 亚服
        case "9":
          return game_region[this.game][5] // 港澳台服
      }
    }
    return game_region[this.game][0] // 官服
  }

  async getData(type, data = {}, cached = false) {
    if (!this._device_fp && !data?.Getfp && !data?.headers?.["x-rpc-device_fp"]) {
      this._device_fp = await this.getData("getFp", {
        seed_id: this.generateSeed(16),
        Getfp: true,
      })
    }
    if (type === "getFp" && !data?.Getfp) return this._device_fp

    let { url, headers, body } = this.getUrl(type, data)

    if (!url) return false

    let cacheKey = this.cacheKey(type, data)
    let cahce = await redis.get(cacheKey)
    if (cahce) return JSON.parse(cahce)

    headers.Cookie = this.cookie

    if (data.headers) {
      headers = { ...headers, ...data.headers }
    }

    if (type !== "getFp" && !headers["x-rpc-device_fp"] && this._device_fp.data?.device_fp) {
      headers["x-rpc-device_fp"] = this._device_fp.data.device_fp
    }

    let param = {
      headers,
      agent: await this.getAgent(),
      timeout: 10000,
    }
    if (body) {
      param.method = "post"
      param.body = body
    } else {
      param.method = "get"
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
      logger.mark("mys接口没有返回")
      return false
    }

    res.api = type

    if (cached) this.cache(res, cacheKey)

    return res
  }

  getHeaders(query = "", body = "") {
    const cn = {
      app_version: "2.40.1",
      User_Agent: `Mozilla/5.0 (Linux; Android 12; ${this.device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36 miHoYoBBS/2.40.1`,
      client_type: "5",
      Origin: "https://webstatic.mihoyo.com",
      X_Requested_With: "com.mihoyo.hyperion",
      Referer: "https://webstatic.mihoyo.com/",
    }
    const os = {
      app_version: "2.55.0",
      User_Agent:
        "Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0",
      client_type: "2",
      Origin: "https://act.hoyolab.com",
      X_Requested_With: "com.mihoyo.hoyolab",
      Referer: "https://act.hoyolab.com/",
    }
    let client
    if (/cn_|_cn/.test(this.server)) {
      client = cn
    } else {
      client = os
    }
    return {
      "x-rpc-app_version": client.app_version,
      "x-rpc-client_type": client.client_type,
      "User-Agent": client.User_Agent,
      Referer: client.Referer,
      DS: this.getDs(query, body),
    }
  }

  getDs(q = "", b = "") {
    let n = ""
    if (/cn_|_cn/.test(this.server)) {
      n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs"
    } else {
      n = "okr4obncj8bw5a65hbnn5oo6ixjc3l9w"
    }
    let t = Math.round(new Date().getTime() / 1000)
    let r = Math.floor(Math.random() * 900000 + 100000)
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`)
    return `${t},${r},${DS}`
  }

  getGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4()
  }

  cacheKey(type, data) {
    return "Yz:genshin:mys:cache:" + md5(this.uid + type + JSON.stringify(data))
  }

  async cache(res, cacheKey) {
    if (!res || res.retcode !== 0) return
    redis.setEx(cacheKey, this.cacheCd, JSON.stringify(res))
  }

  async getAgent() {
    let proxyAddress = cfg.bot.proxyAddress
    if (!proxyAddress) return null
    if (proxyAddress === "http://0.0.0.0:0") return null

    if (/cn_|_cn/.test(this.server)) return null

    if (HttpsProxyAgent === "") {
      HttpsProxyAgent = await import("https-proxy-agent").catch(err => {
        logger.error(err)
      })

      HttpsProxyAgent = HttpsProxyAgent ? HttpsProxyAgent.HttpsProxyAgent : undefined
    }

    if (HttpsProxyAgent) {
      return new HttpsProxyAgent(proxyAddress)
    }

    return null
  }

  generateSeed(length = 16) {
    const characters = "0123456789abcdef"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)]
    }
    return result
  }
}
