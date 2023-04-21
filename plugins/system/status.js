import cfg from '../../lib/config/config.js'
import moment from 'moment'

export class status extends plugin {
  constructor () {
    super({
      name: '其他功能',
      dsc: '#状态',
      event: 'message',
      rule: [
        {
          reg: '^#状态$',
          fnc: 'status'
        }
      ]
    })
  }

  async status () {
    if (this.e.isMaster) return this.statusMaster()

    if (!this.e.isGroup) {
      this.reply('请群聊查看')
      return
    }

    return this.statusGroup()
  }

  async statusMaster () {
    let runTime = moment().diff(moment.unix(this.e.bot.stat.start_time), 'seconds')
    let Day = Math.floor(runTime / 3600 / 24)
    let Hour = Math.floor((runTime / 3600) % 24)
    let Min = Math.floor((runTime / 60) % 60)
    if (Day > 0) {
      runTime = `${Day}天${Hour}小时${Min}分钟`
    } else {
      runTime = `${Hour}小时${Min}分钟`
    }

    let format = (bytes) => {
      return (bytes / 1024 / 1024).toFixed(2) + 'MB'
    }

    let msg = '-------状态-------'
    msg += `\n运行时间：${runTime}`
    msg += `\n内存使用：${format(process.memoryUsage().rss)}`
    msg += `\n当前版本：v${cfg.package.version}`
    msg += '\n-------累计-------'
    msg += await this.getCount()

    await this.reply(msg)
  }

  async statusGroup () {
    let msg = '-------状态-------'
    msg += await this.getCount(this.e.group_id)

    await this.reply(msg)
  }

  async getCount (groupId = '') {
    this.date = moment().format('MMDD')
    this.month = Number(moment().month()) + 1

    this.key = 'Yz:count:'

    if (groupId) {
      this.key += `group:${groupId}:`
    }

    this.msgKey = {
      day: `${this.key}sendMsg:day:`,
      month: `${this.key}sendMsg:month:`
    }

    this.screenshotKey = {
      day: `${this.key}screenshot:day:`,
      month: `${this.key}screenshot:month:`
    }

    let week = {
      msg: 0,
      screenshot: 0
    }
    for (let i = 0; i <= 6; i++) {
      let date = moment().startOf('week').add(i, 'days').format('MMDD')

      week.msg += Number(await redis.get(`${this.msgKey.day}${date}`)) ?? 0
      week.screenshot += Number(await redis.get(`${this.screenshotKey.day}${date}`)) ?? 0
    }

    let count = {
      total: {
        msg: await redis.get(`${this.key}sendMsg:total`) || 0,
        screenshot: await redis.get(`${this.key}screenshot:total`) || 0
      },
      today: {
        msg: await redis.get(`${this.msgKey.day}${this.date}`) || 0,
        screenshot: await redis.get(`${this.screenshotKey.day}${this.date}`) || 0
      },
      week,
      month: {
        msg: await redis.get(`${this.msgKey.month}${this.month}`) || 0,
        screenshot: await redis.get(`${this.screenshotKey.month}${this.month}`) || 0
      }
    }

    let msg = ''
    if (groupId) {
      msg = `\n发送消息：${count.today.msg}条`
      msg += `\n生成图片：${count.today.screenshot}次`
    } else {
      msg = `\n发送消息：${count.total.msg}条`
      msg += `\n生成图片：${count.total.screenshot}次`
    }

    if (count.month.msg > 200) {
      msg += '\n-------本周-------'
      msg += `\n发送消息：${count.week.msg}条`
      msg += `\n生成图片：${count.week.screenshot}次`
    }
    if (moment().format('D') >= 8 && count.month.msg > 400) {
      msg += '\n-------本月-------'
      msg += `\n发送消息：${count.month.msg}条`
      msg += `\n生成图片：${count.month.screenshot}次`
    }

    return msg
  }
}
