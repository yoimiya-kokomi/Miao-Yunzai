import moment from 'moment'
import lodash from 'lodash'
import base from './base.js'
import MysInfo from './mys/mysInfo.js'

export default class Note extends base {
  constructor (e) {
    super(e)
    this.model = 'dailyNote'
  }

  /** 生成体力图片 */
  static async get (e) {
    let note = new Note(e)
    return await note.getData()
  }

  async getData () {
    let device_fp = await MysInfo.get(this.e, 'getFp')
    let headers = { 'x-rpc-device_fp': device_fp?.data?.device_fp }

    let res = await MysInfo.get(this.e, 'dailyNote', { headers })
    let resUser
    if (!res || res.retcode !== 0) return false

    /** 截图数据 */
    let data = this.e.isSr ? this.noteSr(res) : this.noteData(res)

    let screenData = this.screenData
    if (this.e.isSr) {
      resUser = await MysInfo.get(this.e, 'UserGame', { headers })
      resUser.data?.list?.forEach(v => this.e.uid.includes(v.game_biz))
      if (!resUser || resUser.retcode !== 0) return false
    }
    return {
      name: this.e.sender.card,
      quality: 80,
      ...screenData,
      ...data,
      ...resUser?.data?.list[0]
    }
  }

  noteSr (res) {
    let { data } = res
    let nowDay = moment().date()
    let nowUnix = Number(moment().format('X'))
    /** 树脂 */
    let resinMaxTime
    if (data.stamina_recover_time > 0) {
      let d = moment.duration(data.stamina_recover_time, 'seconds')
      let day = Math.floor(d.asDays())
      let hours = d.hours()
      let minutes = d.minutes()
      let seconds = d.seconds()
      resinMaxTime = hours + '小时' + minutes + '分钟' + seconds + '秒'
      // 精确到秒。。。。
      if (day > 0) {
        resinMaxTime = day + '天' + hours + '小时' + minutes + '分钟' + seconds + '秒'
      } else if (hours > 0) {
        resinMaxTime = hours + '小时' + minutes + '分钟' + seconds + '秒'
      } else if (minutes > 0) {
        resinMaxTime = minutes + '分钟' + seconds + '秒'
      } else if (seconds > 0) {
        resinMaxTime = seconds + '秒'
      }
      if ((day > 0) || (hours > 0) || (seconds > 0)) {
        let total_seconds = 3600 * hours + 60 * minutes + seconds
        const now = new Date()
        const dateTimes = now.getTime() + total_seconds * 1000
        const date = new Date(dateTimes)
        const dayDiff = date.getDate() - now.getDate()
        const str = dayDiff === 0 ? '今日' : '明日'
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date
              .getMinutes()
              .toString()
              .padStart(2, '0')}`
        let recoverTimeStr = ` | [${str}]${timeStr}`
        resinMaxTime += recoverTimeStr
      }
    }
    data.bfStamina = data.current_stamina / data.max_stamina * 100 + '%'
    /** 派遣 */
    for (let item of data.expeditions) {
      let d = moment.duration(item.remaining_time, 'seconds')
      let day = Math.floor(d.asDays())
      let hours = d.hours()
      let minutes = d.minutes()
      item.dateTime = ([day + '天', hours + '时', minutes + '分'].filter(v => !['0天', '0时', '0分'].includes(v))).join('')
      item.bfTime = (72000 - item.remaining_time) / 72000 * 100 + '%'
      if (item.avatars.length == 1) {
        item.avatars.push('派遣头像')
      }
    }
    // 标识属性图标~
    let icon = lodash.sample(['希儿', '白露', '艾丝妲', '布洛妮娅', '姬子', '卡芙卡', '克拉拉', '停云', '佩拉', '黑塔', '希露瓦', '银狼'])
    let week = [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六'
    ]
    let day = `${week[moment().day()]}`
    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      icon,
      day,
      resinMaxTime,
      nowDay: moment(new Date()).format('YYYY年MM月DD日'),
      ...data
    }
  }

  noteData (res) {
    let { data } = res

    let nowDay = moment().date()
    let nowUnix = Number(moment().format('X'))

    /** 树脂 */
    let resinMaxTime
    if (data.resin_recovery_time > 0) {
      resinMaxTime = nowUnix + Number(data.resin_recovery_time)

      let maxDate = moment.unix(resinMaxTime)
      resinMaxTime = maxDate.format('HH:mm')

      if (maxDate.date() != nowDay) {
        resinMaxTime = `明天 ${resinMaxTime}`
      } else {
        resinMaxTime = ` ${resinMaxTime}`
      }
    }

    /** 派遣 */
    let remainedTime = ''
    if (data.expeditions && data.expeditions.length >= 1) {
      remainedTime = lodash.map(data.expeditions, 'remained_time')
      remainedTime = lodash.min(remainedTime)

      if (remainedTime > 0) {
        remainedTime = nowUnix + Number(remainedTime)
        let remainedDate = moment.unix(remainedTime)
        remainedTime = remainedDate.format('HH:mm')

        if (remainedDate.date() != nowDay) {
          remainedTime = `明天 ${remainedTime}`
        } else {
          remainedTime = ` ${remainedTime}`
        }
      }
    }

    /** 宝钱 */
    let coinTime = ''
    if (data.home_coin_recovery_time > 0) {
      let coinDay = Math.floor(data.home_coin_recovery_time / 3600 / 24)
      let coinHour = Math.floor((data.home_coin_recovery_time / 3600) % 24)
      let coinMin = Math.floor((data.home_coin_recovery_time / 60) % 60)
      if (coinDay > 0) {
        coinTime = `${coinDay}天${coinHour}小时${coinMin}分钟`
      } else {
        let coinDate = moment.unix(
          nowUnix + Number(data.home_coin_recovery_time)
        )

        if (coinDate.date() != nowDay) {
          coinTime = `明天 ${coinDate.format('HH:mm')}`
        } else {
          coinTime = coinDate.format('HH:mm')
        }
      }
    }

    let week = [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六'
    ]
    let day = `${moment().format('MM-DD HH:mm')} ${week[moment().day()]}`

    /** 参量质变仪 */
    if (data?.transformer?.obtained) {
      data.transformer.reached = data.transformer.recovery_time.reached
      let recoveryTime = ''

      if (data.transformer.recovery_time.Day > 0) {
        recoveryTime += `${data.transformer.recovery_time.Day}天`
      }
      if (data.transformer.recovery_time.Hour > 0) {
        recoveryTime += `${data.transformer.recovery_time.Hour}小时`
      }
      if (data.transformer.recovery_time.Minute > 0) {
        recoveryTime += `${data.transformer.recovery_time.Minute}分钟`
      }
      data.transformer.recovery_time = recoveryTime
    }

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      resinMaxTime,
      remainedTime,
      coinTime,
      day,
      ...data
    }
  }
}
