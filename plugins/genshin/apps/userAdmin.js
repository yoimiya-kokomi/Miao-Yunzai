import plugin from '../../../lib/plugins/plugin.js'
import User from '../model/user.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import MysInfo from '../model/mys/mysInfo.js'

export class user extends plugin {
  constructor (e) {
    super({
      name: '用户管理',
      dsc: 'CK用户管理',
      event: 'message',
      priority: 300,
      rule: [{
        reg: '^#用户统计$',
        fnc: 'userAdmin',
        permission: "master",
      }, {
        reg: '^#(刷新|重置)用户(缓存|统计|ck|Ck|CK)$',
        fnc: 'resetCache',
        permission: "master",
      }, {
        reg: '^#删除(无效|失效)(用户|ck|Ck|CK)$',
        fnc: 'delDisable',
        permission: "master",
      }]
    })
    this.User = new User(e)
    this.button = segment.button([
      { text: "用户统计", callback: "#用户统计" },
      { text: "删除无效", callback: "#删除无效用户" },
    ],[
      { text: "刷新统计", callback: "#刷新用户统计" },
      { text: "重置统计", callback: "#重置用户统计" },
    ])
  }

  /** #用户统计$ */
  async userAdmin () {
    let data = await new User(this.e).userAdmin()
    if (!data) return true

    /** 生成图片 */
    this.reply([await this.renderImg('genshin', 'html/admin/userAdmin', data, { retType: "base64" }), this.button])
  }

  /** #刷新用户缓存 / #重置用户缓存 */
  async resetCache () {
    // 清空老数据
    const clearData = /重置/.test(this.e.msg)
    await MysInfo.initCache(true, clearData)
    this.reply([`用户缓存已${clearData ? '重置' : '刷新'}...\n通过【#用户统计】命令可查看详情`, this.button])
  }

  async delDisable () {
    let count = await MysInfo.delDisable()
    this.reply([count > 0 ? `已删除${count}个无效用户` : '暂无无效用户...', this.button])
  }
}
