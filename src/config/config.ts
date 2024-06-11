import YAML from 'yaml'
import fs from 'node:fs'
import chokidar from 'chokidar'
import { join } from 'node:path'
import { CONFIG_DEFAULT_PATH, CONFIG_INIT_PATH } from './system.js'

/**
 * ********
 * 配置文件
 * ********
 */
class Cfg {

  /**
   * 
   */
  config = {}

  /**
   * 监听文件
   */
  watcher = { config: {}, defSet: {} }

  /**
   * 
   */
  constructor() {
    this.initCfg()
  }


  /**
   * 初始化配置
   */
  initCfg() {
    const path = CONFIG_INIT_PATH
    const pathDef = CONFIG_DEFAULT_PATH
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      }
    }
    if (!fs.existsSync("data")) fs.mkdirSync("data")
    if (!fs.existsSync("resources")) fs.mkdirSync("resources")
  }

  /**
   * 机器人qq号
   */
  get qq() {
    return Number(this.getConfig('qq').qq)
  }

  /**
   * 密码
   */
  get pwd() {
    return this.getConfig('qq').pwd
  }

  /**
   * icqq配置
   */
  get bot() {
    let bot = this.getConfig('bot')
    let defbot = this.getdefSet('bot')
    const Config = { ...defbot, ...bot }
    Config.platform = this.getConfig('qq').platform
    /**
     * 设置data目录，防止pm2运行时目录不对
     */
    Config.data_dir = join(process.cwd(), `/data/icqq/${this.qq}`)
    if (!Config.ffmpeg_path) delete Config.ffmpeg_path
    if (!Config.ffprobe_path) delete Config.ffprobe_path
    return Config
  }

  /**
   * 
   */
  get other() {
    return this.getConfig('other')
  }

  /**
   * 
   */
  get redis() {
    return this.getConfig('redis')
  }

  /**
   * 
   */
  get renderer() {
    return this.getConfig('renderer');
  }

  /**
   * 
   */
  get notice() {
    return this.getConfig('notice');
  }

  /**
   * 主人qq
   */
  get masterQQ() {
    const qqs = this.getConfig('other')?.masterQQ || []
    if (Array.isArray(qqs)) {
      return qqs.map(qq => String(qq))
    } else {
      return [String(qqs)]
    }
  }

  _package = null

  /**
   * package.json 
   */
  get package() {
    if (this._package) return this._package
    try {
      const data = fs.readFileSync('package.json', 'utf8')
      this._package = JSON.parse(data)
      return this._package
    } catch {
      return {}
    }
  }

  /**
   * 群配置
   * @param groupId 
   * @returns 
   */
  getGroup(groupId = '') {
    const config = this.getConfig('group')
    const defCfg = this.getdefSet('group')
    if (config[groupId]) {
      return { ...defCfg.default, ...config.default, ...config[groupId] }
    }
    return { ...defCfg.default, ...config.default }
  }

  /**
   * other配置
   * @returns 
   */
  getOther() {
    const def = this.getdefSet('other')
    const config = this.getConfig('other')
    return { ...def, ...config }
  }

  /**
   * notice配置
   * @returns 
   */
  getNotice() {
    const def = this.getdefSet('notice')
    const config = this.getConfig('notice')
    return { ...def, ...config }
  }

  /**
   * 得到默认配置
   * @param name 配置文件名称
   * @returns 
   */
  getdefSet(name: string) {
    return this.getYaml('default_config', name)
  }

  /**
   * 得到生成式配置
   * @param name 
   * @returns 
   */
  getConfig(name: string) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml(type, name) {
    let file = `config/${type}/${name}.yaml`
    let key = `${type}.${name}`
    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /**
   * 监听配置文件
   * @param file 
   * @param name 
   * @param type 
   * @returns 
   */
  watch(file:string, name:string, type = 'default_config') {
    const key = `${type}.${name}`
    if (this.watcher[key]) return
    const watcher = chokidar.watch(file)
    watcher.on('change', () => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      logger.mark(`[修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })
    this.watcher[key] = watcher
  }

  /**
   * 
   * @returns 
   */
  change_qq() {
    if (process.argv.includes('login') || !this.qq) return
    logger.info('修改机器人QQ或密码，请手动重启')
  }

  /**
   * 修改日志等级
   */
  async change_bot() {
    const log = await import('./log.js')
    log.default()
  }

}

/**
 * **********
 * 
 * ***
 */
export default new Cfg()