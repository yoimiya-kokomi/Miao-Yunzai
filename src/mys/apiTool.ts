import { randomRange } from '../utils/index.js'

/**
 * 整合接口用于查询数据
 * 方便后续用于解耦
 * 临时处理，后续大概率重写 主要原因（懒）
 */
export default class apiTool {
  uid = null
  isSr = false
  server = null
  game = 'genshin'

  /**
   *
   * @param {用户uid} uid
   * @param {区服} server
   * @param {是否为星穹铁道或其他游戏? type(bool or string)} isSr
   */
  constructor(uid: string | null, server: string, isSr: boolean = false) {
    uid && (this.uid = uid)
    typeof isSr != 'undefined' && (this.uid = uid)
    server && (this.server = server)

    // init
    this.game = 'genshin'

    if (isSr) this.game = 'honkaisr'
    if (typeof isSr !== 'boolean') this.game = isSr
  }

  /**
   *
   * @param data
   * @returns
   */
  getUrlMap = (data: any = {}) => {
    let host, hostRecord, hostPublicData
    if (
      ['cn_gf01', 'cn_qd01', 'prod_gf_cn', 'prod_qd_cn'].includes(this.server)
    ) {
      host = 'https://api-takumi.mihoyo.com/'
      hostRecord = 'https://api-takumi-record.mihoyo.com/'
      hostPublicData = 'https://public-data-api.mihoyo.com/'
    } else if (/os_|official/.test(this.server)) {
      host = 'https://sg-public-api.hoyolab.com/'
      hostRecord = 'https://bbs-api-os.hoyolab.com/'
      hostPublicData = 'https://sg-public-data-api.hoyoverse.com/'
    }
    let urlMap = {
      genshin: {
        /** 体力接口fp参数用于避开验证码 */
        ...(['cn_gf01', 'cn_qd01'].includes(this.server)
          ? {
              getFp: {
                url: `${hostPublicData}device-fp/api/getFp`,
                body: {
                  seed_id: data.seed_id,
                  device_id: data.deviceId.toUpperCase(),
                  platform: '1',
                  seed_time: new Date().getTime() + '',
                  ext_fields: `{"proxyStatus":"0","accelerometer":"-0.159515x-0.830887x-0.682495","ramCapacity":"3746","IDFV":"${data.deviceId.toUpperCase()}","gyroscope":"-0.191951x-0.112927x0.632637","isJailBreak":"0","model":"iPhone12,5","ramRemain":"115","chargeStatus":"1","networkType":"WIFI","vendor":"--","osVersion":"17.0.2","batteryStatus":"50","screenSize":"414×896","cpuCores":"6","appMemory":"55","romCapacity":"488153","romRemain":"157348","cpuType":"CPU_TYPE_ARM64","magnetometer":"-84.426331x-89.708435x-37.117889"}`,
                  app_name: 'bbs_cn',
                  device_fp: '38d7ee834d1e9'
                }
              }
            }
          : {
              getFp: {
                url: `${hostPublicData}device-fp/api/getFp`,
                body: {
                  seed_id: data.seed_id,
                  device_id: data.deviceId.toUpperCase(),
                  platform: '5',
                  seed_time: new Date().getTime() + '',
                  ext_fields: `{"userAgent":"Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0","browserScreenSize":"387904","maxTouchPoints":"5","isTouchSupported":"1","browserLanguage":"zh-CN","browserPlat":"Linux aarch64","browserTimeZone":"Asia/Shanghai","webGlRender":"Adreno (TM) 640","webGlVendor":"Qualcomm","numOfPlugins":"0","listOfPlugins":"unknown","screenRatio":"2.625","deviceMemory":"4","hardwareConcurrency":"8","cpuClass":"unknown","ifNotTrack":"unknown","ifAdBlock":"0","hasLiedLanguage":"0","hasLiedResolution":"1","hasLiedOs":"0","hasLiedBrowser":"0","canvas":"${randomRange()}","webDriver":"0","colorDepth":"24","pixelRatio":"2.625","packageName":"unknown","packageVersion":"2.27.0","webgl":"${randomRange()}"}`,
                  app_name: 'hk4e_global',
                  device_fp: '38d7f2364db95'
                }
              }
            }),
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
          url: `${host}event/e20200928calculate/v3/batch_compute`,
          body: data.body
        },
        blueprintCompute: {
          url: `${host}event/e20200928calculate/v1/furniture/compute`,
          body: data.body
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
        /** 七圣召唤数据 */
        basicInfo: {
          url: `${hostRecord}game_record/app/genshin/api/gcg/basicInfo`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        /**七圣牌组 */
        deckList: {
          url: `${hostRecord}game_record/app/genshin/api/gcg/deckList`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        /** 七圣召唤角色牌数据 */
        avatar_cardList: {
          url: `${hostRecord}game_record/app/genshin/api/gcg/cardList`,
          query: `limit=999&need_action=false&need_avatar=true&need_stats=true&offset=0&role_id=${this.uid}&server=${this.server}`
        },
        /** 七圣召唤行动牌数据 */
        action_cardList: {
          url: `${hostRecord}game_record/app/genshin/api/gcg/cardList`,
          query: `limit=999&need_action=true&need_avatar=false&need_stats=true&offset=0&role_id=${this.uid}&server=${this.server}`
        },
        /**使用兑换码 目前仅限国际服,来自于国服的uid请求已在myinfo.js的init方法提前拦截 */
        useCdk: {
          url: 'PLACE_HOLDER',
          query: null
        }
      },
      honkaisr: {
        ...(['prod_gf_cn', 'prod_qd_cn'].includes(this.server)
          ? {
              UserGame: {
                url: `${host}binding/api/getUserGameRolesByCookie`,
                query: `game_biz=hkrpg_cn&region=${this.server}&game_uid=${this.uid}`
              },
              /** 体力接口fp参数用于避开验证码 */
              getFp: {
                url: `${hostPublicData}device-fp/api/getFp`,
                body: {
                  seed_id: data.seed_id,
                  device_id: data.deviceId.toUpperCase(),
                  platform: '1',
                  seed_time: new Date().getTime() + '',
                  ext_fields: `{"proxyStatus":"0","accelerometer":"-0.159515x-0.830887x-0.682495","ramCapacity":"3746","IDFV":"${data.deviceId.toUpperCase()}","gyroscope":"-0.191951x-0.112927x0.632637","isJailBreak":"0","model":"iPhone12,5","ramRemain":"115","chargeStatus":"1","networkType":"WIFI","vendor":"--","osVersion":"17.0.2","batteryStatus":"50","screenSize":"414×896","cpuCores":"6","appMemory":"55","romCapacity":"488153","romRemain":"157348","cpuType":"CPU_TYPE_ARM64","magnetometer":"-84.426331x-89.708435x-37.117889"}`,
                  app_name: 'bbs_cn',
                  device_fp: '38d7ee834d1e9'
                }
              }
            }
          : {
              UserGame: {
                url: `${host}binding/api/getUserGameRolesByCookie`,
                query: `game_biz=hkrpg_global&region=${this.server}&game_uid=${this.uid}`
              },
              /** 体力接口fp参数用于避开验证码 */
              getFp: {
                url: `${hostPublicData}device-fp/api/getFp`,
                body: {
                  seed_id: data.seed_id,
                  device_id: data.deviceId.toUpperCase(),
                  platform: '5',
                  seed_time: new Date().getTime() + '',
                  ext_fields: `{"userAgent":"Mozilla/5.0 (Linux; Android 11; J9110 Build/55.2.A.4.332; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 miHoYoBBSOversea/2.55.0","browserScreenSize":"387904","maxTouchPoints":"5","isTouchSupported":"1","browserLanguage":"zh-CN","browserPlat":"Linux aarch64","browserTimeZone":"Asia/Shanghai","webGlRender":"Adreno (TM) 640","webGlVendor":"Qualcomm","numOfPlugins":"0","listOfPlugins":"unknown","screenRatio":"2.625","deviceMemory":"4","hardwareConcurrency":"8","cpuClass":"unknown","ifNotTrack":"unknown","ifAdBlock":"0","hasLiedLanguage":"0","hasLiedResolution":"1","hasLiedOs":"0","hasLiedBrowser":"0","canvas":"${randomRange()}","webDriver":"0","colorDepth":"24","pixelRatio":"2.625","packageName":"unknown","packageVersion":"2.27.0","webgl":"${randomRange()}"}`,
                  app_name: 'hkrpg_global',
                  device_fp: '38d7f2364db95'
                }
              }
            }),
        /** 首页宝箱 */
        index: {
          url: `${hostRecord}game_record/app/hkrpg/api/index`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        basicInfo: {
          url: `${hostRecord}game_record/app/hkrpg/api/role/basicInfo`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        /** 深渊 （混沌回忆） */
        spiralAbyss: {
          url: `${hostRecord}game_record/app/hkrpg/api/challenge`,
          query: `role_id=${this.uid}&schedule_type=${data.schedule_type || 1}&server=${this.server}`
        },
        avatarInfo: {
          url: `${hostRecord}game_record/app/hkrpg/api/avatar/info`,
          query: `need_wiki=true&role_id=${this.uid}&server=${this.server}`
        },
        /** 开拓月历接口 */
        ys_ledger: {
          url: `${host}event/srledger/month_info`,
          query: `lang=zh-cn&region=${this.server}&uid=${this.uid}&month=${data.month}`
        },
        /** 角色详情 */
        character: {
          url: `${hostRecord}game_record/app/hkrpg/api/avatar/basic`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        /** 树脂 */
        dailyNote: {
          url: `${hostRecord}game_record/app/hkrpg/api/note`,
          query: `role_id=${this.uid}&server=${this.server}`
        },
        /** 养成计算器 */
        compute: {
          url: `${host}event/rpgcalc/compute?`,
          query: `game=hkrpg`,
          body: data.body
        },
        /** 详情 */
        detail: {
          url: `${host}event/rpgcalc/avatar/detail`,
          query: `game=hkrpg&lang=zh-cn&item_id=${data.avatar_id}&tab_from=${data.tab_from}&change_target_level=0&uid=${this.uid}&region=${this.server}`
        }
      }
    }

    if (this.server.startsWith('os')) {
      urlMap.genshin.detail.url =
        'https://sg-public-api.hoyolab.com/event/calculateos/sync/avatar/detail' // 角色天赋详情
      urlMap.genshin.detail.query = `lang=zh-cn&uid=${this.uid}&region=${this.server}&avatar_id=${data.avatar_id}`
      urlMap.genshin.avatarSkill.url =
        'https://sg-public-api.hoyolab.com/event/calculateos/avatar/skill_list' // 查询未持有的角色天赋
      urlMap.genshin.avatarSkill.query = `lang=zh-cn&avatar_id=${data.avatar_id}`
      urlMap.genshin.compute.url =
        'https://sg-public-api.hoyolab.com/event/calculateos/compute' // 已支持养成计算
      urlMap.genshin.blueprint.url =
        'https://sg-public-api.hoyolab.com/event/calculateos/furniture/blueprint'
      urlMap.genshin.blueprint.query = `share_code=${data.share_code}&region=${this.server}&lang=zh-cn`
      urlMap.genshin.blueprintCompute.url =
        'https://sg-public-api.hoyolab.com/event/calculateos/furniture/compute'
      urlMap.genshin.blueprintCompute.body = { lang: 'zh-cn', ...data.body }
      urlMap.genshin.ys_ledger.url =
        'https://sg-hk4e-api.hoyolab.com/event/ysledgeros/month_info' // 支持了国际服札记
      urlMap.genshin.ys_ledger.query = `lang=zh-cn&month=${data.month}&uid=${this.uid}&region=${this.server}`
      urlMap.genshin.useCdk.url =
        'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey'
      urlMap.genshin.useCdk.query = `uid=${this.uid}&region=${this.server}&lang=zh-cn&cdkey=${data.cdk}&game_biz=hk4e_global`
    }
    return urlMap[this.game]
  }
}
