export class recallMsg extends plugin {
  constructor () {
    super({
      name: "回复撤回",
      dsc: "撤回回复消息",
      event: "message",
      rule: [
        {
          reg: `^#?撤回$`,
          fnc: "recall"
        }
      ]
    })
  }

  async recall(e) {
    if (e.isMaster && e.reply_id) {
      if (e.group?.recallMsg) {
        e.group.recallMsg(e.reply_id)
        e.group.recallMsg(e.message_id)
      } else if (e.friend?.recallMsg) {
        e.friend.recallMsg(e.reply_id)
        e.friend.recallMsg(e.message_id)
      }
    }
    return false
  }
}