import Renderer from '../renderer/loader.js'

/**
 * 暂时保留对手工引用puppeteer.js的兼容
 * 后期会逐步废弃
 * 只提供截图及分片截图功能
 */
let renderer = Renderer.getRenderer('puppeteer')
renderer.screenshot = async (name, data) => {
    let img = await renderer.render(name, data)
    return img ? segment.image(img) : img
}
renderer.screenshots = async (name, data) => {
    data.multiPage = true
    let imgs = await renderer.render(name, data) || []
    let ret = []
    for (let img of imgs) {
        ret.push(img ? segment.image(img) : img)
    }
    return ret.length > 0 ? ret : false
}

export default renderer