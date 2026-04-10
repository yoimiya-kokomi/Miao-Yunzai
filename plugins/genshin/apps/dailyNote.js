import plugin from "../../../lib/plugins/plugin.js"
import Note from "../model/note.js"
import gsCfg from "../model/gsCfg.js"
import NoteUser from "../model/mys/NoteUser.js"

gsCfg.cpCfg("mys", "set")

export class dailyNote extends plugin {
  constructor() {
    super({
      name: "体力查询",
      dsc: "体力查询",
      event: "message",
      priority: 300,
      rule: [
        {
          reg: "^#*(原神|星铁)?(体力|树脂|查询体力)$",
          fnc: "note",
        },
      ],
    })

    this.set = gsCfg.getConfig("mys", "set")
  }

  /** #体力 */
  async note() {
    const game = this.e?.game || (this.e?.isSr ? "sr" : "gs")
    const user = await NoteUser.create(this.e)
    const uidList = [...new Set(user.getCkUidList(game).map(ds => String(ds.uid)))]

    if (uidList.length === 0) {
      let data = await Note.get(this.e)
      if (!data) return
      await this.renderImg("genshin", `html/player/daily-note-${data.game}`, data)
      return true
    }

    let hasData = false
    for (const uid of uidList) {
      let e = Object.create(this.e)
      e.uid = uid
      e.mysSelfUid = true

      let data = await Note.get(e)
      if (!data) continue

      hasData = true
      await this.renderImg("genshin", `html/player/daily-note-${data.game}`, data)
    }
    if (hasData) return true
  }
}
