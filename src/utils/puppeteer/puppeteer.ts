import Renderer from '../renderer/loader.js'
const renderer = Renderer.getRenderer()
renderer.screenshot = async (name, data) => {
  let img = await renderer.render(name, data)
  return img ? segment.image(img) : img
}
renderer.screenshots = async (name, data) => {
  data.multiPage = true
  let imgs = (await renderer.render(name, data)) || []
  let ret = []
  for (let img of imgs) {
    ret.push(img ? segment.image(img) : img)
  }
  return ret.length > 0 ? ret : false
}
export default renderer
