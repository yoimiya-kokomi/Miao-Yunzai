export * from "./common/common.js"
import ConfigController from "./config/config.js"
export { ConfigController }
import createLogin from "./config/qq.js"
export { createLogin }
import Handler from "./plugins/handler.js"
export { Handler }
export * from "./plugins/index.js"
import Plugin from "./plugins/plugin.js"
export { Plugin }
import Loader from "./plugins/loader.js"
export { Loader }
import Runtime from "./plugins/runtime.js"
export { Runtime }
import puppeteer from "./puppeteer/puppeteer.js"
export { puppeteer }
import Renderer from "./renderer/Renderer.js"
export { Renderer }
import renderer from "./renderer/loader.js"
export { renderer }
export const Bot = new Proxy(
  {},
  {
    get(_, property) {
      return global.Bot[property]
    },
  },
)
export const Redis = new Proxy(
  {},
  {
    get(_, property) {
      return global.redis[property]
    },
  },
)

/**
 * 使用方法

import { Plugin } from '#yunzai'
class Word extends Plugin{
  constructor(){
    super({})
  }
  async post(){
    this.e.reply("post")
  }
}

 */
