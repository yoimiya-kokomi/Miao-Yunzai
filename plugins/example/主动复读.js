import plugin from '../../lib/plugins/plugin.js'

export class example2 extends plugin {
  constructor () {
    super({
      name: '复读',
      dsc: '复读用户发送的内容，然后撤回',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 5000,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^#复读$',
          /** 执行方法 */
          fnc: 'repeat'
        }
      ]
    })
  }

  /** 复读 */
  async repeat () {
    /** 设置上下文，后续接收到内容会执行doRep方法 */
    this.setContext('doRep')
    /** 回复 */
    await this.reply('请发送要复读的内容', false, { at: true })
  }

  /** 接受内容 */
  doRep () {
    /** 复读内容 */
    this.reply(this.e.message, false, { recallMsg: 5 })
    /** 结束上下文 */
    this.finish('doRep')
  }
}
