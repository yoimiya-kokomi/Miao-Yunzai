import { type GroupMessage } from 'icqq'

// 机器人事件类型
export interface EventType extends GroupMessage {
  isMaster: boolean
  group: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recallMsg: (...arg) => any
  }
  msg: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply: (...arg) => Promise<any>
}

// 函数式回调类型
export type MessageCallBackType = (
  e: EventType
) => Promise<boolean | undefined | void>
