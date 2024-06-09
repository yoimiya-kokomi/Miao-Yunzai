import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 发送私聊消息，仅给好友发送
 * @param userId qq号
 * @param msg 消息
 * @param uin 指定bot发送，默认为Bot
 */
export async function relpyPrivate(userId, msg, uin = Bot.uin) {
  userId = Number(userId)
  let friend = Bot.fl.get(userId)
  if (friend) {
    logger.mark(`发送好友消息[${friend.nickname}](${userId})`)
    return await Bot[uin]
      .pickUser(userId)
      .sendMsg(msg)
      .catch(err => {
        logger.mark(err)
      })
  }
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 下载保存文件
 * @param fileUrl 下载地址
 * @param savePath 保存路径
 * @param param
 */
export async function downFile(fileUrl: string, savePath: string, param = {}) {
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

/**
 *
 * @param dirname
 * @returns
 */
export function mkdirs(dirname: string) {
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
export async function makeForwardMsg(
  e: any,
  msg: any[] | string = [],
  dec: string = '',
  msgsscr = false
) {
  // 不是数组
  if (!Array.isArray(msg)) msg = [msg]

  //
  let name = msgsscr ? e.sender.card || e.user_id : Bot.nickname

  //
  const Id = msgsscr ? e.user_id : Bot.uin

  // 是群聊
  if (e.isGroup) {
    try {
      const Info = await e.bot.getGroupMemberInfo(e.group_id, Id)
      name = Info.card || Info.nickname
    } catch (err) {
      console.error(err)
    }
  }

  let forwardMsg:
    | {
        user_id: number
        nickname: string
        message: any
      }[]
    | {
        data: any
      } = []

  /**
   *
   */
  for (const message of msg) {
    if (!message) continue
    forwardMsg.push({
      user_id: Id,
      nickname: name,
      message: message
    })
  }

  /**
   * 制作转发内容
   */
  try {
    /**
     *
     */
    if (e?.group?.makeForwardMsg) {
      // ?
      forwardMsg = await e.group.makeForwardMsg(forwardMsg)
    } else if (e?.friend?.makeForwardMsg) {
      // ?
      forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
    } else {
      //
      return msg.join('\n')
    }

    /**
     *
     */
    if (dec) {
      /**
       * 处理描述
       */
      if (typeof forwardMsg.data === 'object') {
        const Detail = forwardMsg.data?.meta?.detail
        if (Detail) {
          Detail.news = [{ text: dec }]
        }
      } else {
        /**
         *
         */
        forwardMsg.data = forwardMsg.data
          .replace(/\n/g, '')
          .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
          .replace(/___+/, `<title color="#777777" size="26">${dec}</title>`)
      }
    }
  } catch (err) {
    console.error(err)
  }

  return forwardMsg
}
