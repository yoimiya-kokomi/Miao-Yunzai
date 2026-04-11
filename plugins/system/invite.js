import cfg from "../../lib/config/config.js"

export class invite extends plugin {
  constructor() {
    super({
      name: "invite",
      dsc: "邀请自动进群",
      event: "request.group.invite",
    })
  }

  async accept() {
    if (!this.e.isMaster && cfg.other.autoGroup !== 1) {
      logger.mark(`[邀请加群]：${this.e.group_name}：${this.e.group_id}`)
      return
    }
    logger.mark(
      `[${this.e.isMaster ? "主人" : "自动同意"}邀请加群]：${this.e.group_name}：${this.e.group_id}`,
    )
    this.e.approve(true)
    this.e.bot.pickFriend(this.e.user_id).sendMsg(`已同意加群：${this.e.group_name}`)
  }
}
