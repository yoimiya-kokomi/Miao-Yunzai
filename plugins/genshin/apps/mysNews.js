import plugin from '../../../lib/plugins/plugin.js'
import MysNews from '../model/mysNews.js'
import fs from 'node:fs'
import lodash from 'lodash'
import gsCfg from '../model/gsCfg.js'
import YAML from 'yaml'
import common from '../../../lib/common/common.js'
import fetch from 'node-fetch'

gsCfg.cpCfg('mys', 'pushNews')
export class mysNews extends plugin {
  constructor(e) {
    super({
      name: '米游社公告',
      dsc: '#公告 #资讯 #活动',
      event: 'message',
      priority: 7000,
      rule: [
        {
          reg: '^#*(官方|星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?(公告|资讯|活动)(列表|[0-9])*$',
          fnc: 'news'
        },
        {
          reg: '^(#米游社|#mys)(.*)',
          fnc: 'mysSearch'
        },
        {
          reg: '(.*)(bbs.mihoyo.com|miyoushe.com)/ys(.*)/article(.*)',
          fnc: 'mysUrl'
        },
        {
          reg: '^#?(原(神|石)|星(铁|琼)|崩坏三|崩三|水晶|绝区(零)|zzz|菲林)?(预估|盘点)$',
          fnc: 'mysEstimate'
        },
        {
          reg: '^#*(星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?(开启|关闭)(公告|资讯)推送$',
          fnc: 'setPush'
        },
        {
          reg: '^#(星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?推送(公告|资讯)$',
          permission: 'master',
          fnc: 'mysNewsTask'
        },
        {
          reg: '^#(星铁|原神)(开启|关闭)到期活动(预警)?(推送)?$',
          fnc: 'setActivityPush'
        }
      ]
    })

    this.file = './plugins/genshin/config/mys.pushNews.yaml'

    /** 定时任务 */
    this.task = {
      cron: gsCfg.getConfig('mys', 'pushNews').pushTime,
      name: '米游社公告推送任务',
      fnc: () => this.mysNewsTask(),
      log: false
    }
  }

  async init() {
    if (fs.existsSync(this.file)) return

    fs.copyFileSync('./plugins/genshin/defSet/mys/pushNews.yaml', this.file)
  }

  async news() {
    let gids = this.gids()
    let data = await new MysNews(this.e).getNews(gids)
    if (!data) return
    await this.reply(data)
  }

  async mysNewsTask() {
    let mysNews = new MysNews(this.e)
    await mysNews.ActivityPush()
    await mysNews.mysNewsTask()
  }
  async setActivityPush() {
    if (!this.e.isGroup) {
      await this.reply('推送请在群聊中设置')
      return
    }
    if (!this.e.member?.is_admin && !this.e.isMaster) {
      await this.reply('暂无权限，只有管理员才能操作', true)
      return true
    }
    let typeName
    let pushGame
    if(this.e.msg.includes('星铁')) {
      typeName = `srActivityPush`
      pushGame = `星铁`
    } else {
      typeName = `gsActivityPush`
      pushGame = `原神`
    }
    let cfg = gsCfg.getConfig('mys', 'pushNews')
    if(!cfg[typeName]) cfg[typeName] = {}
    if(!Array.isArray(cfg[typeName][this.e.self_id])) cfg[typeName][this.e.self_id] = []
    let model
    let msg = `${pushGame}活动到期预警推送已`
    if(this.e.msg.includes('开启')) {
      model = '开启'
      cfg[typeName][this.e.self_id].push(this.e.group_id)
      cfg[typeName][this.e.self_id] = lodash.uniq(cfg[typeName][this.e.self_id])
      msg += `${model}\n如有即将到期的活动将自动推送至此`
    } else {
      model = '关闭'
      msg += model
      cfg[typeName][this.e.self_id] = lodash.difference(cfg[typeName][this.e.self_id], [this.e.group_id])
      if (lodash.isEmpty(cfg[typeName][this.e.self_id]))
      delete cfg[typeName][this.e.self_id]
    }
    let yaml = YAML.stringify(cfg)
    fs.writeFileSync(this.file, yaml, 'utf8')

    logger.mark(`${this.e.logFnc} ${model}${pushGame}活动到期预警：${this.e.group_id}`)
    await this.reply(msg)
  }
  async mysSearch() {
    if (/签到/g.test(this.e.msg)) return false
    let data = await new MysNews(this.e).mysSearch()
    if (!data) return
    await this.reply(data)
  }

  async mysUrl() {
    let data = await new MysNews(this.e).mysUrl()
    if (!data) return
    await this.reply(data)
  }

  async mysEstimate() {
    let args = ['原石统计汇总', 137101761] /* 数字为通行证ID 可更换 */
    if (/星(琼|铁)/.test(this.e.msg))
      args = ['星琼统计汇总', 137101761]
    if (/绝区(零)|zzz|菲林/.test(this.e.msg))
      args = ['菲林统计汇总', 137101761]
    if (/崩坏三|崩三|水晶/.test(this.e.msg))
      args = ['水晶统计', 80216695]
    /*  args = ['水晶量', 51369902]  */
    /* 自行选择水晶预估作者 */
    let data = await new MysNews(this.e).mysEstimate(...args)
    if (!data) return
    await this.reply(data)
  }

  async setPush() {
    if (!this.e.isGroup) {
      await this.reply('推送请在群聊中设置')
      return
    }
    if (!this.e.member?.is_admin && !this.e.isMaster) {
      await this.reply('暂无权限，只有管理员才能操作', true)
      return true
    }

    let cfg = gsCfg.getConfig('mys', 'pushNews')
    let gids = this.gids()

    let game = gids == 1 ? 'bbb' : gids == 2 ? 'gs' : gids == 3 ? 'bb' : gids == 4 ? 'wd' : gids == 6 ? 'sr' : 'zzz'
    let type = `${game}announceGroup`
    let typeName = '公告'
    if (this.e.msg.includes('资讯')) {
      type = `${game}infoGroup`
      typeName = '资讯'
    }

    let model
    let name = await new MysNews(this.e).game(gids)
    let msg = `${name}${typeName}推送已`
    if (!Array.isArray(cfg[type][this.e.self_id]))
      cfg[type][this.e.self_id] = []

    if (this.e.msg.includes('开启')) {
      model = '开启'
      cfg[type][this.e.self_id].push(this.e.group_id)
      cfg[type][this.e.self_id] = lodash.uniq(cfg[type][this.e.self_id])
      msg += `${model}\n如有最新${typeName}将自动推送至此`
    } else {
      model = '关闭'
      msg += `${model}`
      cfg[type][this.e.self_id] = lodash.difference(cfg[type][this.e.self_id], [this.e.group_id])
      if (lodash.isEmpty(cfg[type][this.e.self_id]))
        delete cfg[type][this.e.self_id]
    }

    let yaml = YAML.stringify(cfg)
    fs.writeFileSync(this.file, yaml, 'utf8')

    logger.mark(`${this.e.logFnc} ${model}${typeName}推送：${this.e.group_id}`)
    await this.reply(msg)
  }

  gids() {
    let msg = this.e.msg.replace(/[#公告资讯活动开启关闭推送列表0-9]/g, '');
    switch (msg) {
      case '崩坏三':
      case '崩三':
        return 1
      case '原神':
        return 2
      case '崩坏学园二':
      case '崩坏二':
      case '崩二':
        return 3
      case '未定事件簿':
      case '未定':
        return 4
      case '星铁':
        return 6
      case '绝区零':
        return 8
    }
    return 2
  }
}
