export class recallReply extends plugin {
  constructor() {
    super({
      name: "回复撤回",
      dsc: "撤回回复消息",
      event: "message",
      priority: -Infinity,
      rule: [
        {
          reg: `^#?撤回$`,
          fnc: "recall"
        }
      ]
    })
  }

  async recall(e) {
    if (!e.isMaster) return false
    let recall
    if (e.group?.recallMsg)
      recall = e.group.recallMsg.bind(e.group)
    else if (e.friend?.recallMsg)
      recall = e.friend.recallMsg.bind(e.friend)
    else if (e.bot.recallMsg)
      recall = e.bot.recallMsg.bind(e.bot)
    else return false
    if (e.message_id) recall(e.message_id)
    const reply_id = e.reply_id || (e.getReply && (await e.getReply())?.message_id)
    if (reply_id) recall(reply_id)
  }
}