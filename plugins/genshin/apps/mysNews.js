import plugin from '../../../lib/plugins/plugin.js'
import MysNews from '../model/mysNews.js'
import fs from 'node:fs'
import lodash from 'lodash'
import gsCfg from '../model/gsCfg.js'
import YAML from 'yaml'

gsCfg.cpCfg('mys', 'pushNews')
export class mysNews extends plugin {
  constructor(e) {
    super({
      name: '米游社公告',
      dsc: '#公告 #资讯 #活动',
      event: 'message',
      priority: 700,
      rule: [
        {
          reg: '^#*(官方|星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?(公告|资讯|活动)[0-9]*$',
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
          reg: '^#*原(石|神)(预估|盘点)$',
          fnc: 'ysEstimate'
        },
        {
          reg: '^#*(星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?(开启|关闭)(公告|资讯)推送$',
          fnc: 'setPush'
        },
        {
          reg: '^#(星铁|原神|崩坏三|崩三|绝区零|崩坏二|崩二|崩坏学园二|未定|未定事件簿)?推送(公告|资讯)$',
          permission: 'master',
          fnc: 'mysNewsTask'
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
    await mysNews.mysNewsTask()
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

  async ysEstimate() {
    let data = await new MysNews(this.e).ysEstimate()
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
    let msg = this.e.msg.replace(/[#公告资讯活动开启关闭推送]/g, '');
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
