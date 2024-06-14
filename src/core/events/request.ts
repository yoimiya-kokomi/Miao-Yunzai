import EventListener from '../listener.js'
/**
 * 监听群聊消息
 */
export class EventRequest extends EventListener {
  /**
   *
   */
  constructor() {
    /**
     *
     */
    super({ event: 'request' })
  }

  /**
   *
   * @param e
   */
  async execute(e) {
    this.plugins.deal(e)
  }
}
