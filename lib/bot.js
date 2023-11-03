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
    /** 加载icqq事件监听 */
    await ListenerLoader.load(bot)

    if (cfg.bot.skip_login) {
      /** 造个假~! */
      bot.uin = 88888
      bot[bot.uin] = bot
      return bot
    } else {
      await bot.login(cfg.qq, cfg.pwd)
      bot[bot.uin] = bot
      return bot
    }
  }
}