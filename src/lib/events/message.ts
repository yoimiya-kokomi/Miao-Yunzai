import EventListener from '../listener/listener.js'

/**
 * 监听群聊消息
 */
export default class messageEvent extends EventListener {
  constructor () {
    super({ event: 'message' })
  }

  async execute (e) {
    this.plugins.deal(e)
  }
}
