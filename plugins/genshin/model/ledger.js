import base from './base.js'
import GsCfg from './gsCfg.js'
import MysInfo from './mys/mysInfo.js'
import MysApi from './mys/mysApi.js'
import lodash from 'lodash'
import moment from 'moment'
import fs from 'node:fs'
import common from '../../../lib/common/common.js'

export default class Ledger extends base {
  constructor(e) {
    super(e)
    this.e = e
    this.model = 'ledger'
    if (this.e.msg?.includes('星琼'))
      this.e.isSr = true

    this.color = ['#73a9c6', '#d56565', '#70b2b4', '#bd9a5a', '#739970', '#7a6da7', '#597ea0']
    this.action = {
      "other": 0,
      "adventure_reward": 1,
      "space_reward": 2,
      "daily_reward": 3,
      "abyss_reward": 4,
      "mail_reward": 5,
      "event_reward": 6
    }
  }

  async get() {
    this.getMonth()
    if (!this.month) return

    let res = await MysInfo.get(this.e, 'ys_ledger', { month: this.month })
    if (!res || res.retcode !== 0) return false

    this.e.nowData = res.data
    let data = this.dealData(res.data)

    this.saveLedger(this.e.uid)

    return data
  }

  getMonth() {
    let month = this.e.msg.replace(/#|原石|月|札记|星铁|星琼/g, '')
    let NowMonth = Number(moment().month()) + 1
    let monthData = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
    if (month) {
      if (isNaN(month)) {
        for (let i in monthData) {
          if (month == monthData[i]) {
            month = Number(i) + 1
            break
          }
        }
        if (isNaN(month)) {
          month = NowMonth
        }
      }
    } else {
      month = NowMonth
    }
    if (month < 1 || month > 12) {
      month = NowMonth
    }

    // 获取前三个月
    let monthArr = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].splice(NowMonth - 1, 3)
    if (!monthArr.includes(Number(month))) {
      this.e.reply('札记仅支持查询最近三个月的数据')
      return false
    }
    if ((NowMonth >= 3 && month > NowMonth) || (NowMonth < 3 && month > NowMonth && month <= 9 + month)) {
      month = NowMonth
    }
    if (this.e.isSr) {
      this.NowMonth = moment().year().toString() + (NowMonth < 10 ? '0' : '') + NowMonth.toString()
      this.month = moment().year().toString() + (month < 10 ? '0' : '') + month.toString()
      this.srmonth = month
    } else {
      this.NowMonth = NowMonth
      this.month = month
    }
  }

  dealData(ledgerInfo) {
    let day
    if (this.month == this.NowMonth) {
      day = `${this[this.e.isSr ? 'srmonth' : 'month']}月${moment().date()}号`
    } else {
      day = `${this[this.e.isSr ? 'srmonth' : 'month']}月`
    }

    let gacha = this.e.isSr ? 'current_hcoin' : 'current_primogems'
    let last_gacha = this.e.isSr ? 'last_hcoin' : 'last_primogems'
    let mora = this.e.isSr ? 'current_rails_pass' : 'current_mora'
    let last_mora = this.e.isSr ? 'last_rails_pass' : 'last_mora'

    ledgerInfo.month_data.gacha = (ledgerInfo.month_data[gacha] / 160).toFixed(0)
    ledgerInfo.month_data.last_gacha = (ledgerInfo.month_data[last_gacha] / 160).toFixed(0)
    if (ledgerInfo.month_data[gacha] > 10000) {
      ledgerInfo.month_data[gacha] = (ledgerInfo.month_data[gacha] / 10000).toFixed(2) + ' w'
    }
    if (ledgerInfo.month_data[last_gacha] > 10000) {
      ledgerInfo.month_data[last_gacha] = (ledgerInfo.month_data[last_gacha] / 10000).toFixed(2) + ' w'
    }
    if (ledgerInfo.month_data[mora] > 10000) {
      ledgerInfo.month_data[mora] = (ledgerInfo.month_data[mora] / 10000).toFixed(1) + ' w'
    }
    if (ledgerInfo.month_data[last_mora] > 10000) {
      ledgerInfo.month_data[last_mora] = (ledgerInfo.month_data[last_mora] / 10000).toFixed(1) + ' w'
    }
    if (ledgerInfo.day_data[gacha] > 10000) {
      ledgerInfo.day_data[gacha] = (ledgerInfo.day_data[gacha] / 10000).toFixed(1) + ' w'
    }
    if (ledgerInfo.day_data[mora] > 10000) {
      ledgerInfo.day_data[mora] = (ledgerInfo.day_data[mora] / 10000).toFixed(1) + ' w'
    }

    ledgerInfo.color = []
    ledgerInfo.month_data.group_by.forEach((item) => {
      if (this.e.isSr) {
        item.color = this.color[this.action[item.action]]
        item.action_name = item.action_name.slice(0, 4)
      } else {
        item.color = this.color[item.action_id]
      }
      ledgerInfo.color.push(item.color)
    })

    ledgerInfo.group_by = JSON.stringify(ledgerInfo.month_data.group_by)
    ledgerInfo.color = JSON.stringify(ledgerInfo.color)

    let icon = ''
    if(this.e.isSr)
      icon = lodash.sample(fs.readdirSync(`${this._path}/plugins/genshin/resources/StarRail/img/role`).filter(file => file.endsWith('.webp')))

    let week = [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六'
    ]

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      day, icon, 
      srday: `${week[moment().day()]}`,
      nowDay: moment(new Date()).format('YYYY年MM月DD日'),
      ...ledgerInfo,
      ...this.screenData
    }
  }

  // 保存上两个原石数据
  async saveLedger(uid, ck = '', isTask = false) {
    if (ck) {
      uid = ck.uid
    } else {
      /** 获取个人ck */
      ck = await MysInfo.checkUidBing(uid, this.e.isSr ? 'sr' : 'gs')
    }

    if (!ck || lodash.isEmpty(ck)) {
      return false
    }

    let dataPath = `./data/${this.e?.isSr ? 'SR_NoteData' : 'NoteData'}/${uid}.json`
    let NoteData = {}
    if (fs.existsSync(dataPath)) {
      NoteData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    }
    // 当前年
    let NowYear = Number(moment().year())
    let NowMonth = Number(moment().month()) + 1

    // 获取前三个月
    let monthArr = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].splice(NowMonth - 1, 3)

    for (let month of monthArr) {
      let year = NowYear
      // 上一年
      if (NowMonth <= 2 && month >= 11) {
        year--
      }

      if (!NoteData[year]) NoteData[year] = {}

      if (NoteData[year][month] && NowMonth != month && NoteData[year][month].isUpdate) continue

      let ledgerInfo
      if (NowMonth == month && this.e.nowData && this.e.nowData?.data?.data_month == NowMonth) {
        ledgerInfo = this.e.nowData
      } else {
        let months = month
        if (this.e.isSr) months = String(year) + (month < 10 ? '0' : '') + String(month)

        ledgerInfo = await this.ysLedger(ck, months, isTask)
        if (!ledgerInfo) continue
      }

      if (NowMonth != month) {
        ledgerInfo.isUpdate = true
      }

      NoteData[year][month] = ledgerInfo

      common.sleep(100)
    }

    logger.mark(`[札记查询][自动保存] uid:${uid} 数据已保存`)

    fs.writeFileSync(dataPath, JSON.stringify(NoteData, '', '\t'))
    return NoteData
  }

  async ysLedger(ck, month, isTask) {
    let ledgerInfo = {}
    if (isTask) {
      let mysApi = new MysApi(ck.uid, ck.ck, { log: false }, this.e?.isSr)
      ledgerInfo = await mysApi.getData('ys_ledger', { month })
      ledgerInfo = await new MysInfo(this.e).checkCode(ledgerInfo, 'ys_ledger', mysApi, { month }, isTask)
    } else {
      ledgerInfo = await MysInfo.get(this.e, 'ys_ledger', { month })
    }

    if (!ledgerInfo || ledgerInfo.retcode != 0) return false

    return ledgerInfo.data
  }

  async ledgerTask(manual) {
    let cks = (await GsCfg.getBingCk(this.e?.isSr ? 'sr' : 'gs')).ck
    let uids = lodash.map(cks, 'uid')
    let finishTime = moment().add(uids.length * 0.7, 's').format('MM-DD HH:mm:ss')
    logger.mark(`${this.e?.isSr ? '开拓月历' : '札记'}ck:${uids.length}个，预计需要${this.countTime(uids.length)} ${finishTime} 完成`)

    if (manual) {
      await this.e.reply(`开始任务：保存${this.e?.isSr ? '星琼' : '原石'}数据，完成前请勿重复执行`)
      await this.e.reply(`${this.e?.isSr ? '开拓月历' : '札记'}ck：${uids.length}个\n预计需要：${this.countTime(uids.length)}\n完成时间：${finishTime}`)
    }

    for (let uid of uids) {
      let ck = cks[uid]
      this.e.user_id = ck.qq

      await this.saveLedger(uid, ck, true)
      await common.sleep(500)
    }

    if (manual) {
      this.e.reply(`${this.e?.isSr ? '星琼' : '原石'}任务完成`)
    }
  }

  countTime(num) {
    let time = num * 0.7
    let hour = Math.floor((time / 3600) % 24)
    let min = Math.floor((time / 60) % 60)
    let sec = Math.floor(time % 60)
    let msg = ''
    if (hour > 0) msg += `${hour}小时`
    if (min > 0) msg += `${min}分钟`
    if (sec > 0) msg += `${sec}秒`
    return msg
  }

  async ledgerCount() {
    this.model = 'ledgerCount'

    let mysInfo = await MysInfo.init(this.e, 'ys_ledger')
    let uid = mysInfo?.uid
    if (!uid) return false

    /** 保存札记数据 */
    let NoteData = await this.saveLedger(uid)
    /** 处理数据 */
    return this.ledgerCountData(NoteData)
  }

  async ledgerCountHistory() {
    let nowYear
    if (this.e.msg.includes('去年')) {
      nowYear = moment().year() - 1
    } else if (this.e.msg.includes('今年')) {
      nowYear = moment().year()
    } else {
      // 获取年份
      nowYear = this.e.msg.match(/(\d{4})/)
    }
    if (nowYear) {
      nowYear = parseInt(nowYear)
    }
    if (!nowYear) {
      nowYear = moment().year()
    }
    this.model = 'ledgerCount'
    let mysInfo = await MysInfo.init(this.e, 'ys_ledger')
    let uid = mysInfo?.uid
    if (!uid) return false
    let dataPath = `./data/${this.e?.isSr ? 'SR_NoteData' : 'NoteData'}/${uid}.json`
    let NoteData = {}
    if (fs.existsSync(dataPath)) {
      NoteData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    }
    // console.log(NoteData)
    if (!NoteData || lodash.isEmpty(NoteData)) {
      this.e.reply(`${this.e?.isSr ? '暂无星琼数据，请先发送 *星琼' : '暂无原石数据，请先发送 #原石'}`, false, { at: true })
      return false
    }
    NoteData = NoteData[nowYear]
    if (!NoteData) {
      this.e.reply(`uid：${uid} ${nowYear}年无${this.e?.isSr ? '星琼' : '原石'}统计数据！`, false, { at: true })
      return false
    }
    lodash.forEach(NoteData, (val) => {
      val.year = nowYear
    })
    /** 处理数据 */
    return this.ledgerCountData(NoteData, String(nowYear))
  }

  ledgerCountData(NoteData, nowYear) {
    let hasMore = false
    let yearText
    if (!nowYear) {
      // 获取总长度
      if (NoteData && Object.keys(NoteData) && Object.keys(NoteData).length > 0) {
        let len = 0
        Object.keys(NoteData).forEach((year) => {
          let yearData = NoteData[year]
          len += Object.keys(yearData).length
        })
        hasMore = len >= 12
      }

      // 获取最近12个月的数据
      const newNoteData = []
      for (let i = 0; i < 12; i++) {
        let month = Number(moment().month()) + 1 - i
        let year = Number(moment().year())

        if (month <= 0) {
          month = 12 + month
          year--
        }
        if (NoteData[year] && NoteData[year][month]) {
          NoteData[year][month].year = year
          newNoteData.push(NoteData[year][month])
        }
      }
      NoteData = newNoteData
    } else {
      yearText = `${nowYear}年-`
    }

    if (!NoteData || lodash.isEmpty(NoteData)) return

    let data = {
      allPrimogems: 0,
      allMora: 0,
      primogemsMonth: [],
      moraMonth: [],
      yearText
    }

    let Primogems = this.e.isSr ? 'current_hcoin' : 'current_primogems'
    let Mora = this.e.isSr ? 'current_rails_pass' : 'current_mora'
    lodash.forEach(NoteData, (val) => {
      data.allPrimogems += val.month_data[Primogems]
      data.allMora += val.month_data[Mora]
      // 柱状图数据
      if (this.e.isSr)
        val.data_month = val.data_month.slice(-2, -1) == '0' ? val.data_month.slice(-1) : val.data_month.slice(-2)

      data.primogemsMonth.push({
        value: val.month_data[Primogems],
        month: String(val.data_month),
        year: String(val.year),
        name: this.e.isSr ? '星琼' : '原石'
      })
      data.moraMonth.push({
        value: (val.month_data[Mora] / 1000).toFixed(0),
        month: String(val.data_month),
        year: String(val.year),
        name: this.e.isSr ? '专&通票' : '摩拉'
      })
    })

    // 单位处理
    data.allPrimogemsShow = (data.allPrimogems / 10000).toFixed(2) + 'w'
    data.allGacha = (data.allPrimogems / 160).toFixed(0)
    if (this.e.isSr) {
      data.allGacha = (data.allPrimogems / 160 + data.allMora).toFixed(0)
      data.allMora = data.allMora.toFixed(0) + '张'
    } else {
      data.allMora = (data.allMora / 10000).toFixed(0) + 'w'
    }

    // 原石最多
    data.maxPrimogems = lodash.maxBy(data.primogemsMonth, 'value')
    data.maxMora = lodash.maxBy(data.moraMonth, 'value')
    // 按年份月份排序
    data.primogemsMonth = lodash.sortBy(data.primogemsMonth, item => {
      return Number(item.year) * 100 + Number(item.month)
    })

    let groupBy = lodash(NoteData).map('month_data').map('group_by').flatMap().value()

    if (this.e.isSr)
      groupBy.forEach((item) => {
        item.action_id = this.action[item.action]
        item.action = item.action_name.slice(0, 4)
      })

    let pieData = {}
    for (let val of groupBy) {
      if (!pieData[val.action]) {
        pieData[val.action] = {
          num: val.num,
          action: val.action,
          action_id: val.action_id
        }
      } else {
        pieData[val.action].num += val.num
      }
    }

    pieData = lodash.flatMap(pieData, (item) => {
      return item
    })
    pieData = lodash.orderBy(pieData, ['num'], ['desc'])

    data.color = []
    pieData.forEach((item) => {
      data.color.push(this.color[item.action_id])
    })

    data.group_by = pieData

    data.color = JSON.stringify(data.color)
    data.pieData = JSON.stringify(pieData)
    data.primogemsMonth = JSON.stringify(data.primogemsMonth)
    data.hasMore = hasMore

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      ...data,
      ...this.screenData
    }
  }
}
