import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import gsCfg from '../model/gsCfg.js'
import User from '../model/user.js'

export class user extends plugin {
  constructor(e) {
    super({
      name: '用户绑定',
      dsc: '米游社ck绑定，游戏uid绑定',
      event: 'message',
      priority: 300,
      rule: [
        {
          reg: '^#?(体力|[Cc](oo)?[Kk](ie)?)帮助',
          fnc: 'ckHelp'
        },
        {
          reg: '^#[Cc](oo)?[Kk](ie)?代码$',
          fnc: 'ckCode'
        },
        {
          reg: /^#绑定c(oo)?k(ie)?$/i,
          fnc: 'bingCk'
        },
        {
          reg: '(.*)_MHYUUID(.*)',
          event: 'message.private',
          fnc: 'noLogin'
        },
        {
          reg: /^#?(原神|星铁)?我的c(oo)?k(ie)?$/i,
          event: 'message',
          fnc: 'myCk'
        },
        {
          reg: /^#?(原神|星铁)?删除c(oo)?k(ie)?$/i,
          fnc: 'delCk'
        },
        {
          reg: /^#?(原神|星铁)?(删除|解绑)uid(\s|\+)*([0-9]{1,2})?$/i,
          fnc: 'delUid'
        },
        {
          reg: /^#(原神|星铁)?绑定(uid)?(\s|\+)*([1-9]|18)[0-9]{8}$/i,
          fnc: 'bingUid'
        },
        {
          reg: /^#(原神|星铁)?(我的)?(uid)[0-9]{0,2}$/i,
          fnc: 'showUid'
        },
        {
          reg: /^#\\s*(检查|我的)*c(oo)?k(ie)?(状态)*$/i,
          fnc: 'checkCkStatus'
        },
        {
          reg: '^#(接受)?绑定(主|子)?(用户|账户|账号)(\\[[a-zA-Z0-9_\\-:\\]+\\]){0,2}$',
          fnc: 'bindNoteUser'
        },
        {
          reg: '^#(删除绑定|取消绑定|解除绑定|解绑|删除|取消)(主|子)(用户|账户|账号)$',
          fnc: 'bindNoteUser'
        }
      ]
    })
    this.User = new User(e)
  }

  async init() {
    /** 加载旧的绑定ck json */
    await this.loadOldData()
  }

  /** 接受到消息都会执行一次 */
  accept() {
    if (!this.e.msg) return
    // 由于手机端米游社网页可能获取不到ltuid 可以尝试在通行证页面获取login_uid
    if (/(ltoken|ltoken_v2)/.test(this.e.msg) && /(ltuid|login_uid|ltmid_v2)/.test(this.e.msg)) {
      if (this.e.isGroup) {
        this.reply('请私聊发送Cookie', false, { at: true })
        return true
      }
      this.e.ck = this.e.msg
      this.e.msg = '#绑定Cookie'
      return true
    }

    if (/^#?(原神)?绑定uid$/i.test(this.e.msg)) {
      this.setContext("saveUid")
      this.reply("请发送绑定的原神uid", false, { at: true })
      return true
    }

    if (/^#?星铁绑定uid$/i.test(this.e.msg)) {
      this.setContext("saveSrUid")
      this.reply("请发送绑定的星铁uid", false, { at: true })
      return true
    }
  }

  /** 绑定uid */
  saveUid() {
    if (!this.e.msg) return
    let uid = this.e.msg.match(/([1-9]|18)[0-9]{8}/g)
    if (!uid) {
      this.reply("原神UID输入错误", false, { at: true })
      return
    }
    this.e.msg = "#绑定" + this.e.msg
    this.bingUid()
    this.finish("saveUid")
  }

  /** 绑定星铁uid */
  saveSrUid() {
    if (!this.e.msg) return
    let uid = this.e.msg.match(/([1-9]|18)[0-9]{8}/g)
    if (!uid) {
      this.reply("星铁UID输入错误", false, { at: true })
      return
    }
    this.e.msg = "#星铁绑定" + this.e.msg
    this.e.isSr = true
    this.e.game = 'sr'
    this.bingUid()
    this.finish("saveSrUid")
  }

  /** 未登录ck */
  async noLogin() {
    this.reply('绑定Cookie失败\n请先【登录米游社】或【登录通行证】再获取Cookie')
  }

  /** #ck代码 */
  async ckCode() {
    await this.reply('javascript:(()=>{prompt(\'\',document.cookie)})();')
  }

  /** ck帮助 */
  async ckHelp() {
    let set = gsCfg.getConfig('mys', 'set')
    await this.reply(`Cookie绑定配置教程：${set.cookieDoc}\n获取Cookie后【私聊发送】进行绑定`)
  }

  /** 绑定ck */
  async bingCk() {
    let set = gsCfg.getConfig('mys', 'set')

    if (!this.e.ck) {
      await this.reply(`请【私聊】发送米游社Cookie，获取教程：\n${set.cookieDoc}`)
      return
    }

    await this.User.bing()
  }

  /** 删除ck */
  async delCk() {
    let msg = await this.User.delCk()
    await this.reply(msg)
  }

  /** 绑定uid */
  async bingUid() {
    await this.User.bingUid()
  }

  /** #uid */
  async showUid() {
    let index = this.e.msg.match(/[0-9]{1,2}/g)
    if (index && index[0]) {
      await this.User.toggleUid(index[0])
    } else {
      await this.User.showUid()
    }
  }

  async delUid() {
    let index = this.e.msg.match(/[0-9]{1,2}$/g)
    if(!index) {
        this.e.reply(`删除uid请带上序号\n例如：#删除uid1\n发送【#uid】可查看绑定的uid以及对应的序号`)
        return true;
    }
    let uidIdx = index && index[0]
    let game = this.e
    if (uidIdx) {
      await this.User.delUid(uidIdx, game)
    }
  }

  /** 我的ck */
  async myCk() {
    if (this.e.isGroup) {
      await this.reply('请私聊查看')
      return
    }
    await this.User.myCk()
  }

  /** 加载旧的绑定ck json */
  async loadOldData() {
    await this.User.loadOldDataV2()
    await this.User.loadOldDataV3()
    await this.User.loadOldUid()
  }

  /** 检查用户CK状态 **/
  async checkCkStatus() {
    await this.User.checkCkStatus()
  }

  async bindNoteUser() {
    await this.User.bindNoteUser()
  }
}
