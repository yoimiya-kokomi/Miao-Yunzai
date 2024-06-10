import { type GroupMessage } from 'icqq'

/**
 * 机器人事件类型
 */
export interface EventType extends GroupMessage {
  /**
   * 是否是主人
   */
  isMaster: boolean
  /**
   * 群聊
   */
  group: {
    recallMsg: (...arg) => any
  }
  /**
   * 用户消息
   */
  msg: string
  /**
   * 消息发送
   * @param arg
   * @returns
   */
  reply: (...arg) => Promise<any>
}

/**
 * 函数式回调类型
 */
export type MessageCallBackType = (
  e: EventType
) => Promise<boolean | undefined | void>
