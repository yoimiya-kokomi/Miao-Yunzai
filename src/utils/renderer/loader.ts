import fs from 'node:fs'
import yaml from 'yaml'
import lodash from 'lodash'
import { ConfigController as cfg } from '../../config/index.js'

/**
 * 加载渲染器
 */
class RendererLoader {
  /**
   *
   */
  renderers = new Map()

  /**
   *
   */
  dir = './renderers'

  /**
   *
   */
  watcher = {}

  /**
   *
   * @returns
   */
  static async init() {
    const render = new RendererLoader()
    await render.load()
    return render
  }

  /**
   *
   */
  async load() {
    const subFolders = fs
      .readdirSync(this.dir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
    for (let subFolder of subFolders) {
      let name = subFolder.name
      try {
        const rendererFn = await import('../renderers/index.js')
        let configFile = `./config.yaml`
        let rendererCfg = fs.existsSync(configFile)
          ? yaml.parse(fs.readFileSync(configFile, 'utf8'))
          : {}
        let renderer = rendererFn.default(rendererCfg)
        if (
          !renderer.id ||
          !renderer.type ||
          !renderer.render ||
          !lodash.isFunction(renderer.render)
        ) {
          console.warn(
            '渲染后端 ' + (renderer.id || subFolder.name) + ' 不可用'
          )
        }
        this.renderers.set(renderer.id, renderer)
        console.info(`加载渲染后端 ${renderer.id}`)
      } catch (err) {
        console.error(`渲染后端 ${name} 加载失败`)
        console.error(err)
      }
    }
  }

  /**
   *
   * @param name
   * @returns
   */
  getRenderer(name = cfg.renderer?.name || 'puppeteer') {
    // TODO 渲染器降级
    return this.renderers.get(name)
  }

  /**
   *
   */
}

export default await RendererLoader.init()
