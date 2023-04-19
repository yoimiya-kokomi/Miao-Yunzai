import { EventEmitter } from 'events';
import lodash from 'lodash';

import './config/init.js'
import ListenerLoader from './listener/loader.js'
import Messager from './messager/Messager.js';

const botProxyHandler = {
  get(target, prop, receiver) {
    if (prop in receiver) {
      return Reflect.get(...arguments);
    }
    logger.warn("直接调用 Bot 的方法或属性 " + prop + " 已过时，请通过 e.bot 访问。\n调用堆栈: " + (new Error()).stack);
    return receiver.primaryMessager[prop];
  },
  set(target, prop, value, receiver) {
    if (prop in receiver) {
      return Reflect.set(...arguments);
    }
    logger.warn("直接调用 Bot 的方法或属性 " + prop + " 已过时，请通过 e.bot 访问。\n调用堆栈: " + (new Error()).stack);
    receiver.primaryMessager[prop] = value;
    return true;
  }
};

class MessagerManager extends EventEmitter {
  constructor(messagers) {
    super();
    if (!messagers || !lodash.isArray(messagers) || lodash.isEmpty(messagers)) {
      logger.error("加载消息发送器失败，请检查配置.");
      process.exit(1);
    }
    this.messagers = messagers;
    this.primaryMessager = messagers[0];
  }

  on() {
    let [val, callback] = [arguments[0], arguments[1]];
    for (let messager of this.messagers) {
      messager.on(val, (e) => {
        // TODO 包装 icqq event
        e.bot = messager;
        super.emit(val, e);
      });
    }
    super.on(val, (e) => {
      callback(e);
    });
  }

  once() {
    let [val, callback] = [arguments[0], arguments[1]];
    for (let messager of this.messagers) {
      messager.on(val, (e) => {
        // TODO 包装 icqq event
        e.bot = messager;
        super.emit(val, e);
      });
    }
    super.once(val, (e) => {
      callback(e);
    });
  }
}

export default class Yunzai extends MessagerManager {
  constructor(messagers) {
    super(messagers);
  }

  static async run() {
    const messagers = Messager.getMessagers();
    const bot = new Proxy(new Yunzai(messagers), botProxyHandler);
    /** 加载 Yunzai 事件监听 */
    await ListenerLoader.load(bot);
    /** 触发 messager 的登陆操作 **/
    for (let messager of messagers) {
      await messager.login();
    }
    return bot;
  }
}
