import EventListener from '../listener/listener.js'
import fetch from 'node-fetch'
import cfg from '../config/config.js'

/**
 * 监听下线事件
 */
export default class offlineEvent extends EventListener {
  constructor () {
    super({ event: 'system.offline' })
  }

  /** 默认方法 */
  async execute (e) {
    logger.mark('掉线了')
    let config = cfg.getConfig('notice')
    let title = `Miao-Yunzai(${Bot.nickname})已离线，请关注`
    if (config.iyuu) {
      await fetch(`https://iyuu.cn/${config.iyuu}.send?text=${title}&desp=${e.message}`)
    }
    if (config.sct) {
      await fetch(`https://sctapi.ftqq.com/${config.sct}.send?title=${title}&content=${e.message}`)
    }
  }
}
