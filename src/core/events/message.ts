import EventListener from '../listener.js'

/**
 * 监听群聊消息
 */
export default class messageEvent extends EventListener {
  /**
   *
   */
  constructor() {
    /**
     *
     */
    super({ event: 'message', prefix: undefined, once: undefined })
  }

  /**
   *
   * @param e
   */
  async execute(e) {
    this.plugins.deal(e)
  }
}
