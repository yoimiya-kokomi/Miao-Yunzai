import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 发送私聊消息
 * @param user_id 账号
 * @param msg 消息
 */
function relpyPrivate(userId, msg) {
  return Bot.pickFriend(userId).sendMsg(msg)
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 下载保存文件
 * @param fileUrl 下载地址
 * @param savePath 保存路径
 */
async function downFile(fileUrl, savePath,param = {}) {
  try {
    mkdirs(path.dirname(savePath))
    logger.debug(`[下载文件] ${fileUrl}`)
    const response = await fetch(fileUrl,param)
    const streamPipeline = promisify(pipeline)
    await streamPipeline(response.body, fs.createWriteStream(savePath))
    return true
  } catch (err) {
    logger.error(`下载文件错误：${err}`)
    return false
  }
}

function mkdirs(dirname) {
  if (fs.existsSync(dirname)) return true
  if (mkdirs(path.dirname(dirname))) {
    fs.mkdirSync(dirname)
    return true
  }
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
  for (const message of msg)
    forwardMsg.push({ message })

  if (e?.group?.makeForwardMsg)
    return e.group.makeForwardMsg(forwardMsg)
  else if (e?.friend?.makeForwardMsg)
    return e.friend.makeForwardMsg(forwardMsg)
  else
    return Bot.makeForwardMsg(forwardMsg)
}

export default { relpyPrivate, sleep, downFile, mkdirs, makeForwardMsg }