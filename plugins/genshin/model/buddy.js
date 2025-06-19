import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"

export default class Buddy extends base {
  constructor(e) {
    super(e)
    this.model = "Buddy"
  }

  async getData() {
    let device_fp = await MysInfo.get(this.e, "getFp")
    let headers = { "x-rpc-device_fp": device_fp?.data?.device_fp }
    let ApiData = {
      buddy: "",
    }
    let res = await MysInfo.get(this.e, ApiData, { headers })

    this.e.apiSync = true

    if (!res || res[0].retcode !== 0) return false

    let buddy = res[0].data

    let screenData = this.screenData

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      name: this.e.sender.card,
      quality: 80,
      ...screenData,
      ...buddy,
    }
  }
}
