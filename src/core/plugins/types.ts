import { type GroupMessage } from 'icqq'
// import { Client } from 'icqq'
// import { PrivateMessage } from 'oicq'

interface EventTypeBase {
  /**
   * 是否是主人
   */
  isMaster: boolean;
  /**
   * 是否是管理员
   */
  // isAdmin: boolean;
  /**
   * 是否是群里
   */
  isGroup: boolean;
  /**
   * 用户消息
   */
  msg: string;
  /**
   * 消息发送
   * @param arg
   * @returns
   */
  reply: (...arg: any[]) => Promise<any>;
  /**
   */
  file: any;
  /**
   */
  bot: any;
  /** 
   * 
   */
  approve: any;
  /**
   * 
   */
  member: any;
  /**
   * 
   */
  logText: any;
  /**
   * 
   */
  isSr?: boolean
  /**
   * 
   */
  isGs?: boolean
  /**
   * 
   */
  self_id?: any
  /**
   * 
   */
  game?: any

  /**
   * 
   */
  logFnc?: any

  /**
   * 
   */
  detail_type?: any

  /**
   * 
   */
  at?: any

  /**
   * 群号
   */
  group_id: number;
  /**
   * 群名
   */
  group_name: string
  /**
   * 
   */
  group: {
    is_owner: any;
    recallMsg: (...arg: any[]) => any;
    getMemberMap: any;
    quit: any;
    mute_left: any

    pickMember: any


    sendMsg: any
  };
  /**
   * 
   */
  atBot: any;

  /**
   * 
   */

  isPrivate?: any

  /**
   * 
   */
  hasAlias?: any

  /**
   * 
   */

  replyNew?: any

  /**
   * 
   */

  isGuild?: any

  /**
   * 
   */
  friend?: any
}

export interface EventType extends EventTypeBase, GroupMessage { }

/**
 * 函数式回调类型
 */
export type MessageCallBackType = (
  e: EventType
) => Promise<boolean | undefined | void>
