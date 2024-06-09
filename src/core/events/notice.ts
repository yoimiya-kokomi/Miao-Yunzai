import EventListener from '../listener.js'

/**
 * 监听群聊消息
 */
export default class noticeEvent extends EventListener {
  /**
   *
   */
  constructor() {
    /**
     *
     */
    super({ event: 'notice', prefix: undefined, once: undefined })
  }

  /**
   *
   * @param e
   */
  async execute(e) {
    this.plugins.deal(e)
  }
}
