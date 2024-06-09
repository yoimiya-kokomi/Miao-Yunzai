/**
 * **********
 * 配置初始化
 * **********
 */
import './lib/config/init.js'
/**
 * 配置读取工具
 */
import cfg from './lib/config/config.js'
/**
 * 监听
 */
import ListenerLoader from './lib/listener/loader.js'
/**
 * 扩展
 */
import { Client } from 'icqq'

/**
 *
 */
export class Yunzai extends Client {
  /**
   *
   * @param conf
   */
  constructor(conf) {
    /**
     *
     */
    super(conf)
  }

  /**
   * 登录机器人
   * @returns
   */
  static async run() {
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

  /**
   * 跳过登录ICQQ
   * @param bot
   * @returns
   */
  static async skip_login(bot) {
    bot.uin = 88888
    bot[bot.uin] = bot
    /** 全局变量 bot */
    global.Bot = bot
    /** 加载插件 */
    return await (await import('./lib/plugins/loader.js')).default.load()
  }
}
