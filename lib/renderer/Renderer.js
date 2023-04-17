import fs from 'node:fs'
import yaml from 'yaml'
import lodash from 'lodash'
import cfg from '../config/config.js'
import { Data } from '#miao'

let rendererBackends = {}

async function registerRendererBackends () {
  const subFolders = fs.readdirSync(`${process.cwd()}/renderers`, { withFileTypes: true }).filter((dirent) => dirent.isDirectory())
  for (let subFolder of subFolders) {
    let name = subFolder.name
    const rendererFn = await Data.importDefault(`/renderers/${name}/index.js`)
    let configFile = `./renderers/${name}/config.yaml`
    let rendererCfg = {}
    if (fs.existsSync(configFile)) {
      try {
        rendererCfg = yaml.parse(fs.readFileSync(configFile, 'utf8'))
      } catch (e) {
        rendererCfg = {}
      }
    }
    let renderer = rendererFn(rendererCfg)
    if (!renderer.id || !renderer.type || !renderer.render || !lodash.isFunction(renderer.render)) {
      logger.warn('渲染后端 ' + (renderer.id || subFolder.name) + ' 不可用')
    }
    rendererBackends[renderer.id] = renderer
    logger.mark('[渲染后端加载]: 导入 ' + renderer.id)
  }
}

await registerRendererBackends()

export default {
  getRenderer () {
    // TODO 渲染器降级
    return rendererBackends[cfg.renderer?.name || 'puppeteer']
  }
}

