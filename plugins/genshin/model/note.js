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
    let res = await MysInfo.get(this.e, 'dailyNote')

    if (!res || res.retcode !== 0) return false
    /** 截图数据 */
    return {
      name: this.e.sender.card,
      quality: 80,
      ...this.screenData,
      ...this.noteData(res)
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
        let coinDate = moment.unix(nowUnix + Number(data.home_coin_recovery_time))

        if (coinDate.date() != nowDay) {
          coinTime = `明天 ${coinDate.format('HH:mm')}`
        } else {
          coinTime = coinDate.format('HH:mm')
        }
      }
    }

    let week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
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
