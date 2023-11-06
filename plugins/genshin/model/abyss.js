import moment from 'moment'
import lodash from 'lodash'
import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import { Character } from '#miao.models'

export default class Abyss extends base {
  constructor (e) {
    super(e)
    this.model = 'abyss'
  }

  async getAbyss () {
    let scheduleType = 1
    if (this.e.msg.includes('上期') || this.e.msg.includes('往期')) {
      scheduleType = 2
    }

    let ApiData = {
      index: '',
      spiralAbyss: { schedule_type: scheduleType }
    }

    /** 同步请求 */
    this.e.apiSync = true

    let res = await MysInfo.get(this.e, ApiData, '')

    if (!res || res[0].retcode !== 0 || res[1].retcode !== 0) return false

    let abyssData = res[1].data

    if (abyssData?.total_battle_times <= 0) {
      await this.e.reply(`uid${this.e.uid}，暂无挑战数据。`)
      return false
    }
    if (!abyssData.damage_rank || abyssData.damage_rank.length <= 0) {
      await this.e.reply(`uid${this.e.uid}，数据还没更新，请稍后再试`)
      return false
    }

    /** 截图数据 */
    let data = {
      name: this.e.sender.card,
      quality: 80,
      ...this.screenData,
      ...this.abyssData(abyssData)
    }

    return data
  }

  abyssData (data) {
    let startTime = moment.unix(data.start_time)
    let time = Number(startTime.month()) + 1
    if (startTime.date() >= 15) {
      time = time + '月下'
    } else {
      time = time + '月上'
    }

    let totalStar = 0
    let star = []
    for (let val of data.floors) {
      if (val.index < 9) {
        continue
      }
      totalStar += val.star
      star.push(val.star)
    }
    totalStar = totalStar + '（' + star.join('-') + '）'

    let dataName = ['damage', 'take_damage', 'defeat', 'normal_skill', 'energy_skill']
    let rankData = []

    for (let val of dataName) {
      if (lodash.isEmpty(data[`${val}_rank`]) || data[`${val}_rank`].length <= 0) {
        data[`${val}_rank`] = [
          {
            value: 0,
            avatar_id: 10000007
          }
        ]
      }

      let char = Character.get(data[`${val}_rank`][0].avatar_id)

      rankData[val] = {
        num: data[`${val}_rank`][0].value,
        name: char.abbr,
        icon: char.side,
      }

      if (rankData[val].num > 1000) {
        rankData[val].num = (rankData[val].num / 10000).toFixed(1)
        rankData[val].num += ' w'
      }
    }

    for (let i in data.reveal_rank) {
      let char = Character.get(data.reveal_rank[i].avatar_id)
      data.reveal_rank[i].name = char.abbr
      data.reveal_rank[i].icon = char.face
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      time,
      max_floor: data.max_floor,
      total_star: totalStar,
      list: data.reveal_rank,
      total_battle_times: data.total_battle_times,
      ...rankData
    }
  }

  /** 深渊十二层 */
  async getAbyssFloor () {
    this.model = 'abyssFloor'
    let scheduleType = 1
    if (this.e.msg.includes('上期') || this.e.msg.includes('往期')) {
      scheduleType = 2
    }
    let ApiData = {
      index: '',
      spiralAbyss: { schedule_type: scheduleType }
    }

    /** 同步请求 */
    this.e.sync = true

    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0 || res[1].retcode !== 0) return false

    let resIndex = res[0].data
    let resAbyss = res[1].data
    let uid = this.e.uid
    let floorIndex = this.getFloor()

    if (!floorIndex) {
      await this.e.reply('深渊层数错误')
      return false
    }

    if (lodash.isEmpty(resAbyss.floors)) {
      await this.e.reply(`uid:${uid}，暂无第${floorIndex}层数据`)
      return false
    }

    let floors = lodash.keyBy(resAbyss.floors, 'index')

    if (lodash.isEmpty(floors[floorIndex])) {
      await this.e.reply(`uid:${uid}，暂无第${floorIndex}层数据`)
      return false
    }

    return {
      saveId: uid,
      uid,
      floorIndex,
      ...this.screenData,
      ...this.abyssFloorData(floors[floorIndex], resIndex)
    }
  }

  getFloor () {
    let reg = /^#*[上期]*(深渊|深境|深境螺旋)[上期]*[第]*(9|10|11|12|九|十|十一|十二)层[ |0-9]*$/
    let floorIndex = this.e.msg.match(reg)

    if (!floorIndex) {
      return false
    }
    floorIndex = floorIndex[2]

    switch (floorIndex) {
      case '9':
      case '九':
        floorIndex = 9
        break
      case '10':
      case '十':
        floorIndex = 10
        break
      case '11':
      case '十一':
        floorIndex = 11
        break
      case '12':
      case '十二':
        floorIndex = 12
        break
      default:
        floorIndex = ''
        break
    }

    return floorIndex
  }

  abyssFloorData (floor, index) {
    let roleArr = lodash.keyBy(index.avatars, 'id')
    let list = []
    for (let val of floor.levels) {
      if (!val.battles || val.battles.length < 2) {
        continue
      }
      val.time = moment.unix(val.battles[0].timestamp).format('YYYY-MM-DD HH:mm:ss')

      for (let i in val.battles) {
        for (let j in val.battles[i].avatars) {
          let char = Character.get(val.battles[i].avatars[j].id)
          val.battles[i].avatars[j].name = char.abbr
          val.battles[i].avatars[j].icon = char.face
          val.battles[i].avatars[j].life = roleArr[val.battles[i].avatars[j].id].actived_constellation_num
        }
      }
      list.push(val)
    }

    return {
      floor,
      list
    }
  }
}
