import moment from "moment"
import lodash from "lodash"
import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"

export default class Note extends base {
  constructor(e) {
    super(e)
    this.model = "dailyNote"
  }

  /** 生成体力图片 */
  static async get(e) {
    let note = new Note(e)
    return await note.getData()
  }

  async getData() {
    const ImgData = {}
    let device_fp = await MysInfo.get(this.e, "getFp")
    let headers = { "x-rpc-device_fp": device_fp?.data?.device_fp }
    let ApiData = {
      dailyNote: "",
    }
    let res = await MysInfo.get(this.e, ApiData, { headers })

    this.e.apiSync = true

    if (!res || res[0].retcode !== 0) return false

    let dailyNote = res[0].data

    const nowDay = moment(new Date()).format("DD")
    if (dailyNote.energy.restore > 0) {
      let resinMaxTime = new Date().getTime() + dailyNote.energy.restore * 1000
      let maxDate = new Date(resinMaxTime)

      resinMaxTime = moment(maxDate).format("HH:mm")
      ImgData.resinMaxTimeMb2 = this.dateTime(maxDate) + moment(maxDate).format("hh:mm")

      if (moment(maxDate).format("DD") !== nowDay) {
        ImgData.resinMaxTimeMb2Day = "明天"
        resinMaxTime = `明天 ${resinMaxTime}`
      } else {
        ImgData.resinMaxTimeMb2Day = "今天"
        resinMaxTime = ` ${resinMaxTime}`
      }
      ImgData.resinMaxTime = resinMaxTime
    }
    ImgData.sale_state = /Doing/.test(dailyNote.vhs_sale.sale_state) ? "正在营业" : "未营业"
    ImgData.card = /Done/.test(dailyNote.card_sign) ? "已完成" : "未完成"

    let screenData = this.screenData

    this.week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      name: this.e.sender.card,
      quality: 80,
      ...screenData,
      ...ImgData,
      dayMb2:
        moment(new Date()).format("yyyy年MM月DD日 HH:mm") + " " + this.week[new Date().getDay()],
      ...dailyNote,
    }
  }

  dateTime(time) {
    return moment(time).format("HH") < 6
      ? "凌晨"
      : moment(time).format("HH") < 12
        ? "上午"
        : moment(time).format("HH") < 17.5
          ? "下午"
          : moment(time).format("HH") < 19.5
            ? "傍晚"
            : moment(time).format("HH") < 22
              ? "晚上"
              : "深夜"
  }
}
