import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 发送私聊消息，仅给好友发送
 * @param user_id qq号
 * @param msg 消息
 */
function relpyPrivate (userId, msg) {
  return Bot.pickUser(userId).sendMsg(msg)
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 下载保存文件
 * @param fileUrl 下载地址
 * @param savePath 保存路径
 */
async function downFile (fileUrl, savePath,param = {}) {
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

function mkdirs (dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirs(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
  }
}

/**
 * 制作转发消息
 * @param e icqq消息e
 * @param msg 消息数组
 */
function makeForwardMsg (e, msg = []) {
  let forwardMsg = []
  msg.forEach(v => { forwardMsg.push({ message: v }) })

  /** 制作转发内容 */
  if (e.group) {
    return e.group.makeForwardMsg(forwardMsg)
  } else if (e.friend) {
    return e.friend.makeForwardMsg(forwardMsg)
  } else {
    return false
  }
}

export default { sleep, relpyPrivate, downFile, makeForwardMsg }
