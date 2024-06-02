import Renderer from "../renderer/loader.js"

/**
 * 暂时保留对手工引用puppeteer.js的兼容
 * 后期会逐步废弃
 * 只提供截图及分片截图功能
 */
const renderer = Renderer.getRenderer()
renderer.screenshot = async (name, data) => {
  const img = await renderer.render(name, data)
  return img ? segment.image(img) : img
}
renderer.screenshots = async (name, data) => {
  data.multiPage = true
  const imgs = await renderer.render(name, data) || []
  const ret = []
  for (const img of imgs)
    ret.push(img ? segment.image(img) : img)
  return ret.length > 0 ? ret : false
}
export default renderer