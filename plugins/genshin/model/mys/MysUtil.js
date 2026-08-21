import { Data } from "#miao"

const games = [
  { key: "gs", name: "原神" },
  { key: "sr", name: "星穹铁道" },
  { key: "zzz", name: "绝区零" },
]

const MysUtil = {
  // 获取标准ltuid
  getLtuid(data) {
    if (!data) {
      return false
    }
    if (/^\d{4,}$/.test(data)) {
      return data
    }
    let ck = data.ck || data
    // 国服为ltuid，国际服v2版ck为ltuid_v2/account_id_v2
    for (let key of ["ltuid", "ltuid_v2", "account_id_v2"]) {
      let testRet = new RegExp(`${key}=(\\d{4,})`).exec(ck)
      if (testRet && testRet[1]) {
        return testRet[1]
      }
    }
    // 国际服部分ck仅有ltmid_v2/account_mid_v2等非数字标识，此处不返回
    // ltuid需为数字（MysUserDB主键为INTEGER），由getUserFullInfo换取通行证id后再写入
    return false
  },

  // 获取标准gameKey
  getGameKey(game) {
    // 兼容e的处理
    if (game.game) {
      game = game.game
    }
    switch (game) {
      case "sr":
      case "star":
        return "sr"
      case "zzz":
        return "zzz"
      default:
        return "gs"
    }
  },

  // 生成设备guid
  getDeviceGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4()
  },

  // 循环game
  async eachGame(fn) {
    await Data.forEach(games, ds => {
      return fn(ds.key, ds)
    })
  },

  // 循环server
  async eachServ(fn) {
    await Data.forEach(["mys", "hoyolab"], fn)
  },
}
export default MysUtil
