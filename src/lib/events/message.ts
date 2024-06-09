import EventListener from '../listener/listener.js'


/**
 * 监听群聊消息
 */
export default class messageEvent extends EventListener {


  /**
   * 
   */
  constructor () {

    /**
     * 
     */
    super({ event: 'message' })
  }

  /**
   * 
   * @param e 
   */
  async execute (e) {
    this.plugins.deal(e)
  }
}
