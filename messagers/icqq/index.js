import {ICQQClient, ICQQSegment} from './lib/icqq.js'

/**
 * @returns messager 消息发送器对象
 * @returns messager.id 消息发送器ID，对应messager中选择的id
 * @returns messager.type 消息发送器的类型，保留字段，暂时支持'IM'
 * @returns messager.constructor 消息发送器的构造器
 * @returns messager.segment 消息发送器所提供的消息构造器
 */
export default {
  id: 'icqq',
  type: 'IM',
  constructor: ICQQClient,
  segment: ICQQSegment
}
