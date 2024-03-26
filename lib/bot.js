import './config/init.js'
import ListenerLoader from './listener/loader.js'
import { Client } from 'icqq'
import cfg from './config/config.js'

export default class Yunzai extends Client {
  // eslint-disable-next-line no-useless-constructor
  constructor (conf) {
    super(conf)
  }

  /** 登录机器人 */
  static async run () {
    const bot = new Yunzai(cfg.bot)
    /** 加载监听事件 */
    await ListenerLoader.load(bot)

    /** 跳过登录 */
    if (cfg.bot.skip_login) return await this.skip_login(bot)

    /** 正常的登录 */
    await bot.login(cfg.qq, cfg.pwd)
    bot[bot.uin] = bot

    /** 全局变量 bot */
    global.Bot = bot
    return bot
  }

  /** 跳过登录ICQQ */
  static async skip_login (bot) {
    bot.uin = 88888
    bot[bot.uin] = bot
    /** 全局变量 bot */
    global.Bot = bot
    /** 加载插件 */
    return await ((await import('../lib/plugins/loader.js')).default).load()
  }
}
