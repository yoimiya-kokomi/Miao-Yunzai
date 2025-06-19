import plugin from "../../../lib/plugins/plugin.js"
import Buddy from "../model/buddy.js"

export class buddy extends plugin {
  constructor() {
    super({
      name: "邦布查询",
      dsc: "邦布查询",
      event: "message",
      priority: 300,
      rule: [
        {
          reg: "^#*绝区零?(邦布|人偶)$",
          fnc: "note",
        },
      ],
    })
  }

  async note() {
    let data = await new Buddy(this.e).getData()
    if (!data) return

    /** 生成图片 */
    this.renderImg("genshin", `ZZZero/html/buddy/buddy`, data)
  }
}
