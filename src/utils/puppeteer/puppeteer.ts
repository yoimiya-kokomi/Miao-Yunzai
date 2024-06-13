import Renderer from '../renderer/loader.js'
/**
 * @deprecated 已废弃
 */
const renderer = Renderer.getRenderer()
renderer.screenshot = async (name, data) => {
  const img = await renderer.render(name, data)
  return img ? segment.image(img) : img
}
renderer.screenshots = async (name, data) => {
  data.multiPage = true
  const imgs = (await renderer.render(name, data)) || []
  const ret = []
  for (let img of imgs) {
    ret.push(img ? segment.image(img) : img)
  }
  return ret.length > 0 ? ret : false
}
export default renderer
