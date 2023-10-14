import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 发送私聊消息，仅给好友发送
 * @param userId qq号
 * @param msg 消息
 */
async function relpyPrivate (userId, msg) {
  userId = Number(userId)

  let friend = Bot.fl.get(userId)
  if (friend) {
    logger.mark(`发送好友消息[${friend.nickname}](${userId})`)
    return await Bot.pickUser(userId).sendMsg(msg).catch((err) => {
      logger.mark(err)
    })
  }
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
 * @param param
 */
async function downFile (fileUrl, savePath, param = {}) {
  try {
    mkdirs(path.dirname(savePath))
    logger.debug(`[下载文件] ${fileUrl}`)
    const response = await fetch(fileUrl, param)
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
 * @param e 消息事件
 * @param msg 消息数组
 * @param dec 转发描述
 * @param msgsscr 转发信息是否伪装
 */
async function makeForwardMsg (e, msg = [], dec = '', msgsscr = false) {

  if (!Array.isArray(msg)) {
    msg = [msg]
  }

  let name = msgsscr ? e.sender.card || e.user_id : Bot.nickname
  let id = msgsscr ? e.user_id : Bot.uin

  if (e.isGroup) {
    try {
      let info = await e.bot.getGroupMemberInfo(e.group_id, id)
      name = info.card || info.nickname
    } catch (err) {
      logger.error(err)
    }
  }

  let userInfo = {
    user_id: id,
    nickname: name
  }

  let forwardMsg = []
  for (const message of msg) {
    if (!message) {
      continue
    }
    forwardMsg.push({
      ...userInfo,
      message: message
    })
  }

  /** 制作转发内容 */
  try {
    if (e?.group?.makeForwardMsg) {
      forwardMsg = await e.group.makeForwardMsg(forwardMsg)
    } else if (e?.friend?.makeForwardMsg) {
      forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
    } else {
      return msg.join('\n')
    }

    if (dec) {
      /** 处理描述 */
      if (typeof (forwardMsg.data) === 'object') {
        let detail = forwardMsg.data?.meta?.detail
        if (detail) {
          detail.news = [{ text: dec }]
        }
      } else {
        forwardMsg.data = forwardMsg.data
          .replace(/\n/g, '')
          .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
          .replace(/___+/, `<title color="#777777" size="26">${dec}</title>`)
      }
    }
  } catch (err) {
    logger.error(err)
  }

  return forwardMsg
}

export default { sleep, relpyPrivate, downFile, makeForwardMsg }
