import EventListener from '../listener.js'

/**
 * 监听群聊消息
 */
export class EventNotice extends EventListener {
  /**
   *
   */
  constructor() {
    /**
     *
     */
    super({ event: 'notice' })
  }

  /**
   *
   * @param e
   */
  async execute(e) {
    this.plugins.deal(e)
  }
}
