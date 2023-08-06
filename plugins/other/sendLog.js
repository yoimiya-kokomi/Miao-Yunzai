import plugin from "../../lib/plugins/plugin.js"
import common from "../../lib/common/common.js"
import fs from "node:fs"
import lodash from "lodash"
import moment from "moment"

export class sendLog extends plugin {
  constructor() {
    super({
      name: "发送日志",
      dsc: "发送最近100条运行日志",
      event: "message",
      rule: [
        {
          reg: "^#(运行|错误)*日志[0-9]*(.*)",
          fnc: "sendLog",
          permission: "master"
        }
      ]
    })

    this.lineNum = 100
    this.maxNum = 1000

    this.logFile = `logs/command.${moment().format("YYYY-MM-DD")}.log`
    this.errFile = "logs/error.log"
  }

  async sendLog() {
    let lineNum = this.e.msg.match(/\d+/g)
    if (lineNum) {
      this.lineNum = lineNum[0]
    } else {
      this.keyWord = this.e.msg.replace(/#|运行|错误|日志|\d/g, "")
    }

    let logFile = this.logFile
    let type = "运行"
    if (this.e.msg.includes("错误")) {
      logFile = this.errFile
      type = "错误"
    }

    if (this.keyWord) type = this.keyWord

    const log = this.getLog(logFile)

    if (lodash.isEmpty(log))
      return this.reply(`暂无相关日志：${type}`)

    return this.reply(await common.makeForwardMsg(this.e, [log.join("\n")], `最近${log.length}条${type}日志`))
  }

  getLog(logFile) {
    let log = fs.readFileSync(logFile, { encoding: "utf-8" })
    log = log.split("\n")

    if (this.keyWord) {
      for (const i in log)
        if (!log[i].includes(this.keyWord))
          delete log[i]
    } else {
      log = lodash.slice(log, (Number(this.lineNum) + 1) * -1)
    }
    log = log.reverse()

    const tmp = []
    for (let i of log) {
      if (!i) continue
      if (this.keyWord && tmp.length >= this.maxNum) return
      /* eslint-disable no-control-regex */
      i = i.replace(/\x1b[[0-9;]*m/g, "")
      i = i.replace(/\r|\n/, "")
      tmp.push(i)
    }
    return tmp
  }
}
