import cfg from '../../lib/config/config.js'
import common from '../../lib/common/common.js'

export class friend extends plugin {
  constructor () {
    super({
      name: 'autoFriend',
      dsc: '自动同意好友',
      event: 'request.friend'
    })
  }

  async accept () {
    if (this.e.sub_type == 'add' || this.e.sub_type == 'single') {
      if (cfg.other.autoFriend == 1) {
        logger.mark(`[自动同意][添加好友] ${this.e.user_id}`)
        await common.sleep(2000)
        this.e.approve(true)
      }
    }
  }
}
