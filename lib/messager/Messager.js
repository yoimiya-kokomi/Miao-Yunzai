import fs from 'node:fs'
import lodash from 'lodash'
import cfg from '../config/config.js'
import { Data } from '#miao'

let messagerBackends = {}

async function registerMessagerBackends() {
  const subFolders = fs.readdirSync(`${process.cwd()}/messagers`, { withFileTypes: true }).filter((dirent) => dirent.isDirectory())
  for (let subFolder of subFolders) {
    let name = subFolder.name
    let messager = await Data.importDefault(`/messagers/${name}/index.js`)
    if (!messager.id || !messager.type || !messager.constructor || !messager.segment || !lodash.isFunction(messager.constructor)) {
      logger.warn('消息发送器 ' + (messager.id || subFolder.name) + ' 不可用')
    }
    messagerBackends[messager.id] = messager
    logger.mark('[消息发送器加载]: 导入 ' + messager.id)
  }
}

await registerMessagerBackends()

export default {
  getMessagers() {
    // TODO 多个消息发送器适配
    const messager = new (messagerBackends[cfg.messager?.name || 'icqq'].constructor)();
    const messagers = [messager];
    return messagers;
  }
}
