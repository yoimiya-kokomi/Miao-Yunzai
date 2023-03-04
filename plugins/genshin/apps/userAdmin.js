import plugin from '../../../lib/plugins/plugin.js'
import User from '../model/user.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'fs'
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
        fnc: 'userAdmin'
      }, {
        reg: '^#(刷新|重置)用户(缓存|统计|ck|Ck|CK)$',
        fnc: 'resetCache'
      }, {
        reg: '^#删除(无效|失效)(用户|ck|Ck|CK)$',
        fnc: 'delDisable'
      }]
    })
    this.User = new User(e)
  }

  checkAuth () {
    if (!this.e.isMaster) {
      this.e.reply('只有管理员可用...')
      return false
    }
    return true
  }

  /** #用户统计$ */
  async userAdmin () {
    if (!this.checkAuth()) {
      return true
    }
    let data = await new User(this.e).userAdmin()
    if (!data) return true

    /** 生成图片 */
    let img = await puppeteer.screenshot('userAdmin', data)
    if (img) await this.reply(img)
  }

  /** #刷新用户缓存 / #重置用户缓存 */
  async resetCache () {
    if (!this.checkAuth()) {
      return true
    }
    // 清空老数据
    const clearData = /重置/.test(this.e.msg)
    await MysInfo.initCache(true, clearData)
    this.e.reply(`用户缓存已${clearData ? '重置' : '刷新'}...\n通过【#用户统计】命令可查看详情`)
  }

  async delDisable () {
    if (!this.checkAuth()) {
      return true
    }
    let count = await MysInfo.delDisable()
    this.e.reply(count > 0 ? `已删除${count}个无效用户` : '暂无无效用户...')
  }
}
