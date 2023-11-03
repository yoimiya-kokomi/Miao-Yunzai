import Yunzai from './lib/bot.js'

/** 全局变量 bot */
global.Bot = await Yunzai.run()

if (Bot.uin == 88888) {
    /** 跳过登录后加载插件... */
    await ((await import('./lib/plugins/loader.js')).default).load()
}