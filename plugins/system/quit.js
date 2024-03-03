import cfg from "../../lib/config/config.js"
export class quit extends plugin {
  constructor() {
    super({
      name: "notice",
      dsc: "自动退群",
      event: "notice.group.increase"
    })
  }

  async accept() {
    if (this.e.user_id != this.e.self_id) return false
    if (!this.e.group?.quit) return false

    const other = cfg.other
    if (!other.autoQuit) return false

    /** 判断主人邀请不退群 */
    if (this.e.bot.gml instanceof Map) {
      const gml = this.e.bot.gml.get(this.e.group_id)
      if (gml instanceof Map) for (const qq of cfg.masterQQ)
        if (gml.has(Number(qq) || String(qq))) {
          logger.mark(`[主人拉群] ${this.e.group_id}`)
          return false
        }
    }

    /** 自动退群 */
    if (Array.from(gl).length <= other.autoQuit && !this.e.group.is_owner) {
      await this.reply("禁止拉群，已自动退出")
      logger.mark(`[自动退群] ${this.e.group_id}`)
      this.e.group.quit()
    }
  }
}