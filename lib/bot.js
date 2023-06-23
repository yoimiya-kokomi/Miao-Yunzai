import './config/init.js'
import cfg from './config/config.js'
import PluginsLoader from './plugins/loader.js'
import ListenerLoader from './listener/loader.js'
import { EventEmitter } from 'events'

export default class Yunzai extends EventEmitter {
  static async run() {
    global.Bot = new Yunzai()
    await PluginsLoader.load()
    await ListenerLoader.load()
    Bot.emit("online")
  }

  getFriendArray() {
    const array = []
    for (const i of Bot.uin)
      Bot[i].fl?.forEach(value =>
        array.push({ ...value, bot_id: i }))
    return array
  }

  getFriendList() {
    const array = []
    for (const i of Bot.uin)
      Bot[i].fl?.forEach((value, key) =>
        array.push(key))
    return array
  }

  getFriendMap() {
    const map = new Map()
    for (const i of Bot.uin)
      Bot[i].fl?.forEach((value, key) =>
        map.set(key, { ...value, bot_id: i }))
    return map
  }

  get fl() {
    return this.getFriendMap()
  }

  getGroupArray() {
    const array = []
    for (const i of Bot.uin)
      Bot[i].gl?.forEach(value =>
        array.push({ ...value, bot_id: i }))
    return array
  }

  getGroupList() {
    const array = []
    for (const i of Bot.uin)
      Bot[i].gl?.forEach((value, key) =>
        array.push(key))
    return array
  }

  getGroupMap() {
    const map = new Map()
    for (const i of Bot.uin)
      Bot[i].gl?.forEach((value, key) =>
        map.set(key, { ...value, bot_id: i }))
    return map
  }

  get gl() {
    return this.getGroupMap()
  }

  pickUser(user_id) {
    return this.pickFriend(user_id)
  }

  pickFriend(user_id) {
    user_id = Number(user_id) || String(user_id)
    const user = Bot.fl.get(user_id)
    if (user) return Bot[user.bot_id].pickFriend(user_id)

    logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
    return false
  }

  pickGroup(group_id) {
    group_id = Number(group_id) || String(group_id)
    const group = Bot.gl.get(group_id)
    if (group) return Bot[group.bot_id].pickGroup(group_id)

    logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
    return false
  }

  pickMember(group_id, user_id) {
    const group = this.pickGroup(group_id)
    if (group) return group.pickMember(user_id)

    return false
  }

  sendFriendMsg(bot_id, user_id, msg) {
    try {
      if (!bot_id)
        return Bot.pickFriend(user_id).sendMsg(msg)

      if (Bot[bot_id])
        return Bot[bot_id].pickFriend(user_id).sendMsg(msg)

      return new Promise(resolve =>
        Bot.once(`connect.${bot_id}`, data =>
          resolve(data.pickFriend(user_id).sendMsg(msg))))
    } catch (err) {
      logger.error(`${logger.blue(`[${bot_id}]`)} 发送好友消息失败：[$${user_id}] ${err}`)
    }
  }

  sendGroupMsg(bot_id, group_id, msg) {
    try {
      if (!bot_id)
        return Bot.pickGroup(group_id).sendMsg(msg)

      if (Bot[bot_id])
        return Bot[bot_id].pickGroup(group_id).sendMsg(msg)

      return new Promise(resolve =>
        Bot.once(`connect.${bot_id}`, data =>
          resolve(data.pickGroup(group_id).sendMsg(msg))))
    } catch (err) {
      logger.error(`${logger.blue(`[${bot_id}]`)} 发送群消息失败：[$${group_id}] ${err}`)
    }
  }

  sendMasterMsg(msg) {
    for (const id in cfg.master)
      for (const i of cfg.master[id])
        this.sendFriendMsg(id, i, msg)
  }

  async getMasterMsg() {
    while (true) {
      const msg = await new Promise(resolve => {
        Bot.once("message", data => {
          if (cfg.master[data.self_id]?.includes(String(data.user_id)) && data.message) {
            let msg = ""
            for (let i of data.message)
              if (i.type = "text")
                msg += i.text.trim()
            resolve(msg)
          } else {
            resolve(false)
          }
        })
      })
      if (msg) return msg
    }
  }

  makeForwardMsg(msg) {
    msg.replace = () => msg
    return { type: "node", data: msg }
  }
}