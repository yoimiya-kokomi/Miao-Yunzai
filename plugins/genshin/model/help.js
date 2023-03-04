import base from './base.js'
import gsCfg from './gsCfg.js'
import cfg from '../../../lib/config/config.js'

export default class Help extends base {
  constructor (e) {
    super(e)
    this.model = 'help'
  }

  static async get (e) {
    let html = new Help(e)
    return await html.getData()
  }

  async getData () {
    let helpData = gsCfg.getdefSet('bot', 'help')

    return {
      ...this.screenData,
      saveId: 'help',
      version: cfg.package.version,
      helpData
    }
  }
}
