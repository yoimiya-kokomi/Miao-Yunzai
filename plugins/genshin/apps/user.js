import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import gsCfg from '../model/gsCfg.js'
import User from '../model/user.js'

export class user extends plugin {
  constructor (e) {
    super({
      name: '用户绑定',
      dsc: '米游社ck绑定，游戏uid绑定',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '^#*(体力|ck|cookie)帮助',
          fnc: 'ckHelp'
        },
        {
          reg: '^(ck|cookie|js)代码$',
          fnc: 'ckCode'
        },
        {
          reg: '^#绑定(cookie|ck)$',
          fnc: 'bingCk'
        },
        {
          reg: '(.*)_MHYUUID(.*)',
          event: 'message.private',
          fnc: 'noLogin'
        },
        {
          reg: '^#?(原神|星铁)?我的(ck|cookie)$',
          event: 'message',
          fnc: 'myCk'
        },
        {
          reg: '^#?删除(ck|cookie)$',
          fnc: 'delCk'
        },
        {
          reg: '^#?(原神|星铁)?(删除|解绑)uid\\s*[0-9]{1,2}$',
          fnc: 'delUid'
        },
        {
          reg: '^#(原神|星铁)?绑定(uid|UID)?[1-9][0-9]{8}$',
          fnc: 'bingUid'
        },
        {
          reg: '^#(原神|星铁)?(我的)?(uid|UID)[0-9]{0,2}$',
          fnc: 'showUid'
        },
        {
          reg: '^#\\s*(检查|我的)*ck(状态)*$',
          fnc: 'checkCkStatus'
        }
      ]
    })
    this.User = new User(e)
  }

  async init () {
    /** 加载旧的绑定ck json */
    await this.loadOldData()
  }

  /** 接受到消息都会执行一次 */
  accept () {
    if (!this.e.msg) return
    // 由于手机端米游社网页可能获取不到ltuid 可以尝试在通行证页面获取login_uid
    if (/(ltoken|ltoken_v2)/.test(this.e.msg) && /(ltuid|login_uid|ltmid_v2)/.test(this.e.msg)) {
      if (this.e.isGroup) {
        this.reply('请私聊发送cookie', false, { at: true })
        return true
      }
      this.e.ck = this.e.msg
      this.e.msg = '#绑定cookie'
      return true
    }

    if (this.e.msg == '#绑定uid') {
      this.setContext('saveUid')
      this.reply('请发送绑定的uid', false, { at: true })
      return true
    }
  }

  /** 绑定uid */
  saveUid () {
    if (!this.e.msg) return
    let uid = this.e.msg.match(/[1|2|5-9][0-9]{8}/g)
    if (!uid) {
      this.reply('uid输入错误', false, { at: true })
      return
    }
    this.e.msg = '#绑定' + this.e.msg
    this.bingUid()
    this.finish('saveUid')
  }

  /** 未登录ck */
  async noLogin () {
    this.reply('绑定cookie失败\n请先【登录米游社】或【登录通行证】再获取cookie')
  }

  /** #ck代码 */
  async ckCode () {
    await this.reply('javascript:(()=>{prompt(\'\',document.cookie)})();')
  }

  /** ck帮助 */
  async ckHelp () {
    let set = gsCfg.getConfig('mys', 'set')
    await this.reply(`Cookie绑定配置教程：${set.cookieDoc}\n获取cookie后【私聊发送】进行绑定`)
  }

  /** 绑定ck */
  async bingCk () {
    let set = gsCfg.getConfig('mys', 'set')

    if (!this.e.ck) {
      await this.reply(`请【私聊】发送米游社cookie，获取教程：\n${set.cookieDoc}`)
      return
    }

    await this.User.bing()
  }

  /** 删除ck */
  async delCk () {
    let msg = await this.User.delCk()
    await this.reply(msg)
  }

  /** 绑定uid */
  async bingUid () {
    await this.User.bingUid()
  }

  /** #uid */
  async showUid () {
    let index = this.e.msg.match(/[0-9]{1,2}/g)
    if (index && index[0]) {
      await this.User.toggleUid(index[0])
    } else {
      await this.User.showUid()
    }
  }

  async delUid () {
    let index = this.e.msg.match(/[0-9]{1,2}$/g)
    let uidIdx = index && index[0]
    let game = this.e
    if (uidIdx) {
      await this.User.delUid(uidIdx, game)
    }
  }

  /** 我的ck */
  async myCk () {
    if (this.e.isGroup) {
      await this.reply('请私聊查看')
      return
    }
    await this.User.myCk()
  }

  /** 加载旧的绑定ck json */
  async loadOldData () {
    await this.User.loadOldDataV2()
    await this.User.loadOldDataV3()
    await this.User.loadOldUid()
  }

  /** 检查用户CK状态 **/
  async checkCkStatus () {
    await this.User.checkCkStatus()
  }
}
