import Renderer from '../renderer/Renderer.js'

/**
 * 暂时保留对手工引用puppeteer.js的兼容
 * 后期会逐步废弃
 * 只提供截图及分片截图功能
 */
export default {
  // 截图
  async screenshot (name, data = {}) {
    let renderer = Renderer.getRenderer()
    let img = await renderer.render(name, data)
    return img ? segment.image(img) : img
  },

  // 分片截图
  async screenshots (name, data = {}) {
    let renderer = Renderer.getRenderer()
    data.multiPage = true
    let imgs = await renderer.render(name, data) || []
    let ret = []
    for (let img of imgs) {
      ret.push(img ? segment.image(img) : img)
    }
    return ret.length > 0 ? ret : false
  }
}

