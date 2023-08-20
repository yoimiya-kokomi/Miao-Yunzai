import EventListener from "../listener/listener.js"
import cfg from "../config/config.js"

/**
 * 监听连接事件
 */
export default class connectEvent extends EventListener {
  constructor() {
    super({ event: "connect" })
  }

  async execute(e) {
    if (!Bot.uin.includes(e.self_id))
      Bot.uin.push(e.self_id)

    if (!cfg.bot.online_msg) return
    const key = `Yz:loginMsg:${e.self_id}`
    if (await redis.get(key)) return
    redis.set(key, "1", { EX: cfg.bot.online_msg_exp })
    for (const i of cfg.master[e.self_id] || [])
      e.bot.pickFriend(i).sendMsg(`欢迎使用【TRSS-Yunzai v${cfg.package.version}】\n【#帮助】查看指令说明\n【#状态】查看运行状态\n【#日志】查看运行日志\n【#重启】重新启动\n【#更新】拉取 Git 更新\n【#全部更新】更新全部插件\n【#更新日志】查看更新日志\n【#设置主人】设置主人账号\n【#安装插件】查看可安装插件`)
  }
}