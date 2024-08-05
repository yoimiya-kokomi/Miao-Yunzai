import fs from "node:fs"

/**
 * 发送私聊消息
 * @param user_id 账号
 * @param msg 消息
 * @param bot_id 机器人账号
 */
function relpyPrivate(user_id, msg, bot_id) {
  return Bot.sendFriendMsg(bot_id, user_id, msg)
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(...args) {
  return Bot.sleep(...args)
}

/**
 * 下载保存文件
 * @param url 下载地址
 * @param file 保存路径
 * @param opts 下载参数
 */
async function downFile(url, file, opts) {
  try {
    return await Bot.download(url, file, opts)
  } catch (err) {
    logger.error("下载文件错误", err)
    return false
  }
}

function mkdirs(dirname) {
  if (fs.existsSync(dirname)) return true
  fs.mkdirSync(dirname, { recursive: true })
  return true
}

/**
 * 制作转发消息
 * @param e 消息事件
 * @param msg 消息数组
 * @param dec 转发描述
 */
function makeForwardMsg(e, msg = [], dec) {
  const forwardMsg = []
  if (dec)
    forwardMsg.push({ message: dec })
  for (const message of Array.isArray(msg) ? msg : [msg])
    forwardMsg.push({ message })

  if (e?.group?.makeForwardMsg)
    return e.group.makeForwardMsg(forwardMsg)
  else if (e?.friend?.makeForwardMsg)
    return e.friend.makeForwardMsg(forwardMsg)
  else
    return Bot.makeForwardMsg(forwardMsg)
}

export default { relpyPrivate, sleep, downFile, mkdirs, makeForwardMsg }