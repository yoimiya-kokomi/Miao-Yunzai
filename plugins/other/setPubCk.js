import plugin from '../../lib/plugins/plugin.js'
import GsCfg from '../genshin/model/gsCfg.js'
import fs from 'node:fs'
import lodash from 'lodash'
import fetch from 'node-fetch'
import YAML from 'yaml'
import MysInfo from '../genshin/model/mys/mysInfo.js'
import common from '../../lib/common/common.js'

export class setPubCk extends plugin {
  constructor (e) {
    super({
      name: '配置',
      dsc: '#配置ck',
      event: 'message',
      priority: 700,
      rule: [
        {
          reg: '^#配置(ck|cookie)$|^#*配置公共查询ck$',
          fnc: 'setPubCk',
          permission: 'master'
        },
        {
          reg: '^#使用(全部|用户)ck$',
          fnc: 'setUserCk',
          permission: 'master'
        }
      ]
    })

    this.file = './plugins/genshin/config/mys.pubCk.yaml'
  }

  /** 配置公共ck */
  async setPubCk () {
    /** 设置上下文，后续接收到内容会执行doRep方法 */
    this.setContext('pubCk')
    /** 回复 */
    await this.reply('请发送米游社cookie......\n配置后该ck将会加入公共查询池')
  }

  async pubCk () {
    let msg = this.e.msg

    if (!(/(ltoken|ltoken_v2)/.test(this.e.msg) && /(ltuid|ltmid_v2|account_mid_v2)/.test(this.e.msg))) {
      this.e.reply('cookie错误，请发送正确的cookie')
      return true
    }

    this.finish('pubCk')

    let ck = msg.replace(/#|'|"/g, '')
    let param = {}
    ck.split(';').forEach((v) => {
      // cookie_token_v2,ltoken_v2值也可能有=
      // let tmp = lodash.trim(v).split('=')
      let tmp = lodash.trim(v);
      let index = tmp.indexOf("=");
      param[tmp.slice(0,index)] = tmp.slice(index+1);
    })

    this.ck = ''
    lodash.forEach(param, (v, k) => {
      if (['ltoken', 'ltuid', 'cookie_token', 'account_id', 'cookie_token_v2', 'account_mid_v2', 'ltmid_v2', 'ltoken_v2'].includes(k)) {
        this.ck += `${k}=${v};`
      }
    })

    /** 检查ck是否失效 */
    if (!await this.checkCk()) {
      logger.mark(`配置公共cookie错误：${this.checkMsg || 'cookie错误'}`)
      await this.e.reply(`配置公共cookie错误：${this.checkMsg || 'cookie错误'}`)
      return
    }

    this.ltuid = param.ltuid
    // 判断是否是v2版ck
    if (param.cookie_token_v2 && (param.account_mid_v2 || param.ltoken_v2) && !(/(\d{4,9})/g).test(this.ltuid)) {
      // 获取米游社通行证id
      let userFullInfo = await this.getUserInfo()
      if (userFullInfo?.data?.user_info) {
        let userInfo = userFullInfo?.data?.user_info
        this.ltuid = userInfo.uid
        this.ck = `${this.ck}ltuid=${this.ltuid};`
      } else {
        logger.mark(`配置公共cookie错误：${userFullInfo.message || 'cookie错误'}`)
        await this.e.reply(`配置公共cookie错误：${userFullInfo.message || 'cookie错误'}`)
        return
      }
    }

    let ckArr = GsCfg.getConfig('mys', 'pubCk') || []

    /** 判断是否重复 */
    for (let ck of ckArr) {
      if (ck.includes(this.ltuid)) {
        await this.e.reply('配置公共cookie错误：该ck已配置')
        return
      }
    }

    ckArr.push(this.ck)
    this.save(ckArr)
    GsCfg.change_myspubCk()

    await this.e.reply(`配置公共ck成功：第${ckArr.length}个`)
  }

  /** 检查ck是否可用 */
  async checkCk () {
    let url = 'https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn'
    let res = await fetch(url, { method: 'get', headers: { Cookie: this.ck } })
    if (!res.ok) return false
    res = await res.json()
    if (res.retcode != 0) {
      this.checkMsg = res.message
      return false
    }

    return true
  }

  // 获取米游社通行证id
  async getUserInfo (server = 'mys') {
    try {
      const that = this
      let url = {
        mys: 'https://bbs-api.mihoyo.com/user/wapi/getUserFullInfo?gids=2',
        hoyolab: ''
      }
      let res = await fetch(url[server], {
        method: 'get',
        headers: {
          Cookie: that.ck,
          Accept: 'application/json, text/plain, */*',
          Connection: 'keep-alive',
          Host: 'bbs-api.mihoyo.com',
          Origin: 'https://m.bbs.mihoyo.com',
          Referer: ' https://m.bbs.mihoyo.com/'
        }
      })
      if (!res.ok) return res
      res = await res.json()
      return res
    } catch (e) {
      return null
    }
  }

  save (data) {
    data = YAML.stringify(data)
    fs.writeFileSync(this.file, data)
  }

  async setUserCk () {
    let set = './plugins/genshin/config/mys.set.yaml'

    let config = fs.readFileSync(set, 'utf8')
    config = config.replace(/allowUseCookie: [0-1]/g, 'allowUseCookie: 1')
    fs.writeFileSync(set, config, 'utf8')

    await common.sleep(500)
    await MysInfo.initCache(true)

    await this.reply('开启成功，用户ck已加入公共查询ck池')
  }
}
