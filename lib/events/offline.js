import EventListener from '../listener/listener.js'

/**
 * 监听下线事件
 */
export default class onlineEvent extends EventListener {
  constructor () {
    super({ event: 'system.offline' })
  }

  /** 默认方法 */
  async execute (e) {
    logger.mark('掉线了')
  }
}
