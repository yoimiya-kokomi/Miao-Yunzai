import { Restart } from "./restart.js"

let insing = false
const list = {
  "Atlas":"https://gitee.com/Nwflower/atlas",
  "ws-plugin":"https://gitee.com/xiaoye12123/ws-plugin",
  "TRSS-Plugin"   :"https://Yunzai.TRSS.me",
  "yenai-plugin"  :"https://gitee.com/yeyang52/yenai-plugin",
  "flower-plugin" :"https://gitee.com/Nwflower/flower-plugin",
  "xianyu-plugin" :"https://gitee.com/suancaixianyu/xianyu-plugin",
  "earth-k-plugin":"https://gitee.com/SmallK111407/earth-k-plugin",
  "useless-plugin":"https://gitee.com/SmallK111407/useless-plugin",
  "StarRail-plugin"   :"https://gitee.com/hewang1an/StarRail-plugin",
  "xiaoyao-cvs-plugin":"https://gitee.com/Ctrlcvs/xiaoyao-cvs-plugin",
  "trss-xianxin-plugin"   :"https://gitee.com/snowtafir/xianxin-plugin",
  "mysVilla-Plugin"   :"https://gitee.com/TimeRainStarSky/Yunzai-mysVilla-Plugin",
  "Telegram-Plugin"   :"https://gitee.com/TimeRainStarSky/Yunzai-Telegram-Plugin",
  "Discord-Plugin":"https://gitee.com/TimeRainStarSky/Yunzai-Discord-Plugin",
  "QQGuild-Plugin":"https://gitee.com/TimeRainStarSky/Yunzai-QQGuild-Plugin",
  "WeChat-Plugin" :"https://gitee.com/TimeRainStarSky/Yunzai-WeChat-Plugin",
  "QQBot-Plugin":"https://gitee.com/TimeRainStarSky/Yunzai-QQBot-Plugin",
  "Route-Plugin"  :"https://gitee.com/TimeRainStarSky/Yunzai-Route-Plugin",
  "ICQQ-Plugin"   :"https://gitee.com/TimeRainStarSky/Yunzai-ICQQ-Plugin",
  "KOOK-Plugin"   :"https://gitee.com/TimeRainStarSky/Yunzai-KOOK-Plugin",
}

export class install extends plugin {
  constructor() {
    super({
      name: "安装插件",
      dsc: "#安装插件 #安装TRSS-Plugin",
      event: "message",
      rule: [
        {
          reg: `^#安装(插件|${Object.keys(list).join("|")})$`,
          fnc: "install",
          permission: "master"
        }
      ]
    })
  }

  async install() {
    if (insing) {
      await this.reply("已有命令安装中..请勿重复操作")
      return false
    }

    const name = this.e.msg.replace(/^#安装/, "").trim()
    if (name == "插件") {
      let msg = "\n"
      for (const name in list)
        if (!await Bot.fsStat(`plugins/${name}`))
          msg += `${name}\n`

      if (msg == "\n")
        msg = "暂无可安装插件"
      else
        msg = `可安装插件列表：${msg}发送 #安装+插件名 进行安装`

      await this.reply(msg)
      return true
    }

    const path = `plugins/${name}`
    if (await Bot.fsStat(path)) {
      await this.reply(`${name} 插件已安装`)
      return false
    }
    await this.runInstall(name, list[name], path)
    this.restart()
  }

  async runInstall(name, url, path) {
    logger.mark(`${this.e.logFnc} 开始安装：${name} 插件`)
    await this.reply(`开始安装 ${name} 插件`)

    const cm = `git clone --depth 1 --single-branch "${url}" "${path}"`
    insing = true
    const ret = await Bot.exec(cm)
    if (await Bot.fsStat(`${path}/package.json`))
      await Bot.exec("pnpm install")
    insing = false

    if (ret.error) {
      logger.mark(`${this.e.logFnc} 插件安装失败：${name}`)
      this.gitErr(ret.error, ret.stdout)
      return false
    }
  }

  async gitErr(err, stdout) {
    let msg = "安装失败！"
    let errMsg = err.toString()
    stdout = stdout.toString()

    if (errMsg.includes('Timed out')) {
      const remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接超时：${remote}`)
    }

    if (/Failed to connect|unable to access/g.test(errMsg)) {
      const remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      return this.reply(`${msg}\n连接失败：${remote}`)
    }

    await this.reply([errMsg, stdout])
  }

  restart() {
    new Restart(this.e).restart()
  }
}