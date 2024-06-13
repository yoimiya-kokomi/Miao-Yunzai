import fs from 'node:fs'
import yaml from 'yaml'
import lodash from 'lodash'
import { ConfigController as cfg } from '../../config/index.js'
import { join } from 'node:path'

/**
 * 加载渲染器
 * @deprecated 已废弃
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
    for (const subFolder of subFolders) {
      const name = subFolder.name
      try {
        const rendererFn = await import('../renderers/index.js')
        const configFile = join(
          process.cwd(),
          'config',
          'config',
          'puppeteer.yaml'
        )
        const rendererCfg = fs.existsSync(configFile)
          ? yaml.parse(fs.readFileSync(configFile, 'utf8'))
          : {}
        const renderer = rendererFn.default(rendererCfg)
        if (
          !renderer.id ||
          !renderer.type ||
          !renderer.render ||
          !lodash.isFunction(renderer.render)
        ) {
          logger.warn('渲染后端 ' + (renderer.id || subFolder.name) + ' 不可用')
        }
        this.renderers.set(renderer.id, renderer)
        logger.info(`加载渲染后端 ${renderer.id}`)
      } catch (err) {
        logger.error(`渲染后端 ${name} 加载失败`)
        logger.error(err)
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
/**
 *
 * @deprecated 已废弃
 */
export default await RendererLoader.init()
