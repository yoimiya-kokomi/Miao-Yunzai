import EventListener from '../listener.js'

/**
 * 监听群聊消息
 */
export class EventMessage extends EventListener {
  /**
   *
   */
  constructor() {
    /**
     *
     */
    super({ event: 'message' })
  }

  /**
   *
   * @param e
   */
  async execute(e) {
    this.plugins.deal(e)
  }
}
