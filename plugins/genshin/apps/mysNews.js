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
          reg: '^#(原(神|石)|星(铁|琼))?(预估|盘点)$',
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
    this.ActivityPush()
    await mysNews.mysNewsTask()
  }
  async ActivityPush() {
    let now = new Date()
    now = now.getHours();
    if(now < 10) return
    let pushGroupList
    try {
      pushGroupList = YAML.parse(fs.readFileSync(this.file, `utf8`))
    } catch (error) {
      logger.error(`[米游社活动到期推送] 活动到期预警推送失败：无法获取配置文件信息\n${error}`)
      return
    }
    if((!pushGroupList.gsActivityPush || pushGroupList.gsActivityPush == {}) && (!pushGroupList.srActivityPush || pushGroupList.srActivityPush == {})) return
    let BotidList = []
    let ActivityPushYaml = {...pushGroupList.gsActivityPush, ...pushGroupList.srActivityPush}
    for (let item in ActivityPushYaml) {
      BotidList.push(item)
    }
    let gsActivityList = await this.getGsActivity()
    let srActivityList = await this.getSrActivity()
    let ActivityList = []
    for (let item of srActivityList) {
      ActivityList.push({ game: `sr`, subtitle: item.title, banner: item.img, title: item.title, end_time: item.end_time })
    }
    for (let item of gsActivityList) {
      ActivityList.push({ game: 'gs', subtitle: item.subtitle, banner: item.banner, title: item.title, end_time: item.end_time})
    }
    if(ActivityList.length === 0) return
    for (let item of BotidList) {
      let redisapgl = await redis.get(`Yz:apgl:${item}`)
      let date = await this.getDate()
      redisapgl = JSON.parse(redisapgl)
      if(!redisapgl || redisapgl.date !== date) {
        redisapgl = {
          date,
          GroupList: ActivityPushYaml[item]
        }
      }
      if(!Array.isArray(redisapgl.GroupList) || redisapgl.GroupList.length == 0) continue
      if(!Bot[item]) {
        redisapgl.GroupList.shift()
        await redis.set(`Yz:apgl:${item}`, JSON.stringify(redisapgl))
        continue
      }
      for (let a of ActivityList) {
        if((!pushGroupList.srActivityPush || !pushGroupList.srActivityPush[item].includes(redisapgl.GroupList[0])) && a.game === `sr`) continue
        if((!pushGroupList.gsActivityPush || !pushGroupList.gsActivityPush[item].includes(redisapgl.GroupList[0])) && a.game === `gs`) continue
        let pushGame
        if(a.game === `sr`) pushGame = `星铁`
        if(a.game === `gs`) pushGame = `原神`
        let endDt = a.end_time
        endDt = endDt.replace(/\s/, `T`)
        let todayt = new Date()
        endDt = new Date(endDt)
        let sydate = await this.calculateRemainingTime(todayt, endDt)
        let msgList = [
          `【${pushGame}活动即将结束通知】`,
          `\n活动:${a.subtitle}`,
          segment.image(a.banner),
          `描述:${a.title}`,
          `\n活动剩余时间:${sydate.days}天${sydate.hours}小时${sydate.minutes}分钟${sydate.seconds}秒`,
          `\n活动结束时间:${a.end_time}`
        ]
        logger.mark(`[米游社活动到期推送] 开始推送 ${item}:${redisapgl.GroupList[0]} ${a.subtitle}`)
        await common.sleep(5000)
        Bot[item].pickGroup(redisapgl.GroupList[0]).sendMsg(msgList)
          .then(() => {}).catch((err) => logger.error(`[米游社活动到期推送] ${item}:${redisapgl.GroupList[0]} 推送失败，错误信息${err}`))
      }
      redisapgl.GroupList.shift()
      await redis.set(`Yz:apgl:${item}`, JSON.stringify(redisapgl))
    }
  }
  async getDate() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`
  }
  async getGsActivity() {
    let gshd
    try {
      gshd = await fetch(`https://hk4e-api.mihoyo.com/common/hk4e_cn/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_cn&lang=zh-cn&bundle_id=hk4e_cn&platform=pc&region=cn_gf01&level=55&uid=100000000`)
      gshd = await gshd.json()
    } catch {
      return []
    }
    let hdlist = []
    let result = []
    for (let item of gshd.data.list[1].list) {
        if(item.tag_label.includes(`活动`) && !item.title.includes(`传说任务`) && !item.title.includes(`游戏公告`)) hdlist.push(item)
    }
    for (let item of hdlist) {
      let endDt = item.end_time
      endDt = endDt.replace(/\s/, `T`)
      let todayt = new Date()
      endDt = new Date(endDt)
      let sydate = await this.calculateRemainingTime(todayt, endDt)
      if(sydate.days <= 1) result.push(item)
    }
    return result
  }
  async getSrActivity() {
    let srhd
    try {
      srhd = await fetch(`https://hkrpg-api.mihoyo.com/common/hkrpg_cn/announcement/api/getAnnList?game=hkrpg&game_biz=hkrpg_cn&lang=zh-cn&auth_appid=announcement&authkey_ver=1&bundle_id=hkrpg_cn&channel_id=1&level=65&platform=pc&region=prod_gf_cn&sdk_presentation_style=fullscreen&sdk_screen_transparent=true&sign_type=2&uid=100000000`)
      srhd = await srhd.json()
    } catch {
      return []
    }
    let hdlist = []
    let result = []
    for (let item of srhd.data.pic_list[0].type_list[0].list) {
      if (item.title) hdlist.push(item)
    }
    for (let item of hdlist) {
      let endDt = item.end_time
      endDt = endDt.replace(/\s/, `T`)
      let todayt = new Date()
      endDt = new Date(endDt)
      let sydate = await this.calculateRemainingTime(todayt, endDt)
      if (sydate.days <= 1) result.push(item)
    }
    return result
  }
  async calculateRemainingTime(startDate, endDate) {
    const difference = endDate - startDate;

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
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
    let args = ['版本原石', 218945821]
    if (/星(琼|铁)/.test(this.e.msg))
      args = ['可获取星琼', 73779489]
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
