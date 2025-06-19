import plugin from "../../../lib/plugins/plugin.js"
import Note from "../model/noteZzz.js"

export class dailyNote extends plugin {
  constructor() {
    super({
      name: "体力查询",
      dsc: "体力查询",
      event: "message",
      priority: 300,
      rule: [
        {
          reg: "^#*绝区零?(体力|树脂|查询体力)$",
          fnc: "note",
        },
      ],
    })
  }

  /** #体力 */
  async note() {
    let data = await Note.get(this.e)
    if (!data) return

    /** 生成图片 */
    this.renderImg("genshin", `ZZZero/html/dailyNote/note`, data)
  }
}
