import { type GroupMessage, Client } from 'icqq'
import { PrivateMessage } from 'oicq'

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
  bot: typeof Client.prototype;
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
}

interface EventTypeGroup extends EventTypeBase, GroupMessage {
  isGroup: true;
  /**
   * 群号
   */
  group_id: number;
  /**
   * 群名
   */
  group_name:string
  /**
   * 
   */
  group: {
    is_owner: any;
    recallMsg: (...arg: any[]) => any;
    getMemberMap: any;
    quit: any;
  };
  /**
   * 
   */
  atBot: any;
}

interface EventTypePrivate extends EventTypeBase, PrivateMessage {
  isGroup: false;
}

export type EventType = EventTypeGroup | EventTypePrivate;

/**
 * 函数式回调类型
 */
export type MessageCallBackType = (
  e: EventType
) => Promise<boolean | undefined | void>
