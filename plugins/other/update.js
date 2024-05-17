import cfg from "../../lib/config/config.js"
import lodash from "lodash"
import fs from "node:fs/promises"
import { Restart } from "./restart.js"

let uping = false

export class update extends plugin {
  constructor() {
    super({
      name: "更新",
      dsc: "#更新 #强制更新",
      event: "message",
      priority: 4000,
      rule: [
        {
          reg: "^#更新日志",
          fnc: "updateLog"
        },
        {
          reg: "^#(安?静)?(强制)?更新",
          fnc: "update"
        },
        {
          reg: "^#全部(安?静)?(强制)?更新$",
          fnc: "updateAll",
          permission: "master"
        }
      ]
    })
    this.typeName = "TRSS-Yunzai"
  }

  get quiet() {
    return /^#(全部)?(安?静)/.test(this.e.msg)
  }

  exec(cmd, plugin, opts = {}) {
    if (plugin) opts.cwd = `plugins/${plugin}`
    return Bot.exec(cmd, opts)
  }

  init() {
    if (cfg.bot.update_time) {
      this.e = {
        isMaster: true,
        logFnc: "[自动更新]",
        msg: "#全部静更新",
        reply: msg => Bot.sendMasterMsg(msg),
      }
      this.autoUpdate()
    }
  }

  autoUpdate() {
    setTimeout(() => {
      this.updateAll()
      this.autoUpdate()
    }, cfg.bot.update_time*60000)
  }

  async update() {
    if (!this.e.isMaster) return false
    if (uping) {
      await this.reply("正在更新，请稍候再试")
      return false
    }

    /** 获取插件 */
    const plugin = await this.getPlugin()
    if (plugin === false) return false

    uping = true
    await this.runUpdate(plugin)

    if (this.isPkgUp)
      await this.exec("pnpm install")
    if (this.isUp)
      this.restart()
    uping = false
  }

  async getPlugin(plugin = this.e.msg.replace(/#(安?静)?(强制)?更新(日志)?/, "")) {
    if (!plugin) return ""
    for (const i of [plugin, `${plugin}-Plugin`, `${plugin}-plugin`])
      if (await Bot.fsStat(`plugins/${i}/.git`)) {
        this.typeName = i
        return i
      }
    return false
  }

  async runUpdate(plugin = "") {
    let cm = "git pull --no-rebase"
    let type = "更新"
    const opts = {}
    if (!plugin) cm = `git checkout package.json && ${cm}`

    if (this.e.msg.includes("强制")) {
      type = "强制更新"
      cm = `git reset --hard ${await this.getRemoteBranch(plugin)} && git pull --rebase --allow-unrelated-histories`
    }
    this.oldCommitId = await this.getCommitId(plugin)

    logger.mark(`${this.e.logFnc} 开始${type} ${this.typeName}`)
    if (!this.quiet)
      await this.reply(`开始${type} ${this.typeName}`)
    const ret = await this.exec(cm, plugin)

    ret.stdout = String(ret.stdout)
    if (ret.error) {
      logger.mark(`${this.e.logFnc} 更新失败 ${this.typeName}`)
      this.gitErr(Bot.String(ret.error), ret.stdout)
      return false
    }

    const time = await this.getTime(plugin)
    if (/Already up|已经是最新/g.test(ret.stdout)) {
      if (!this.quiet)
        await this.reply(`${this.typeName} 已是最新\n最后更新时间：${time}`)
    } else {
      this.isUp = true
      if (/package\.json/.test(ret.stdout))
        this.isPkgUp = true
      await this.reply(`${this.typeName} 更新成功\n更新时间：${time}`)
      await this.reply(await this.getLog(plugin))
    }

    logger.mark(`${this.e.logFnc} 最后更新时间：${time}`)
    return true
  }

  async getCommitId(plugin) {
    const cm = await this.exec("git rev-parse --short HEAD", plugin)
    return lodash.trim(String(cm.stdout))
  }

  async getTime(plugin) {
    const cm = await this.exec('git log -1 --pretty=%cd --date=format:"%F %T"', plugin)
    return lodash.trim(String(cm.stdout))
  }

  async getBranch(plugin) {
    const cm = await this.exec("git branch --show-current", plugin)
    return lodash.trim(String(cm.stdout))
  }

  async getRemote(branch, plugin) {
    const cm = await this.exec(`git config branch.${branch}.remote`, plugin)
    return lodash.trim(String(cm.stdout))
  }

  async getRemoteBranch(plugin) {
    const branch = await this.getBranch(plugin)
    if (!branch) return ""
    const remote = await this.getRemote(branch, plugin)
    if (!remote) return ""
    return `${remote}/${branch}`
  }

  async gitErr(error, stdout) {
    const msg = "更新失败！"

    if (error.includes("Timed out")) {
      const remote = error.match(/'(.+?)'/g)[0].replace(/'/g, "")
      return this.reply(`${msg}\n连接超时：${remote}`)
    }

    if (/Failed to connect|unable to access/g.test(error)) {
      const remote = error.match(/'(.+?)'/g)[0].replace(/'/g, "")
      return this.reply(`${msg}\n连接失败：${remote}`)
    }

    if (error.includes("be overwritten by merge")) {
      return this.reply(`${msg}\n存在冲突：\n${error}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    if (stdout.includes("CONFLICT")) {
      return this.reply(`${msg}\n存在冲突：\n${error}${stdout}\n请解决冲突后再更新，或者执行#强制更新，放弃本地修改`)
    }

    return this.reply([error, stdout])
  }

  async updateAll() {
    if (uping) {
      await this.reply("正在更新，请稍候再试")
      return false
    }

    uping = true
    await this.runUpdate()
    for (let plugin of await fs.readdir("plugins")) {
      plugin = await this.getPlugin(plugin)
      if (plugin === false) continue
      await this.runUpdate(plugin)
    }

    if (this.isPkgUp)
      await Bot.exec("pnpm install")
    if (this.isUp)
      this.restart()
    uping = false
  }

  restart() {
    new Restart(this.e).restart()
  }

  async getLog(plugin = "") {
    let cm = await this.exec('git log -100 --pretty="%h||[%cd] %s" --date=format:"%F %T"', plugin)
    if (cm.error) return this.reply(cm.error.stack)

    const logAll = String(cm.stdout).trim().split("\n")
    if (!logAll.length) return false

    let log = []
    for (let str of logAll) {
      str = str.split("||")
      if (str[0] == this.oldCommitId) break
      if (str[1].includes("Merge branch")) continue
      log.push(str[1])
    }
    let line = log.length
    log = log.join("\n\n")

    if (log.length <= 0) return ""

    cm = await this.exec("git config -l", plugin)
    const end = String(cm.stdout).match(/remote\..*\.url=.+/g).join("\n\n").replace(/remote\..*\.url=/g, "").replace(/\/\/([^@]+)@/, "//")
    if (cm.error) {
      logger.error(cm.error)
      await this.reply(String(cm.error))
    }

    return Bot.makeForwardArray([`${plugin || "TRSS-Yunzai"} 更新日志，共${line}条`, log, end])
  }

  async updateLog() {
    const plugin = await this.getPlugin()
    if (plugin === false) return false
    return this.reply(await this.getLog(plugin))
  }
}