import YAML from 'yaml'
import fs from 'node:fs'
import chokidar from 'chokidar'

/** 配置文件 */
class Cfg {
  constructor () {
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg () {
    let path = './config/config/'
    let pathDef = './config/default_config/'
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      }
    }
  }

  /** 机器人qq号 */
  get qq () {
    return Number(this.getConfig('qq').qq)
  }

  /** 密码 */
  get pwd () {
    return this.getConfig('qq').pwd
  }

  /** icqq配置 */
  get bot () {
    let bot = this.getConfig('bot')
    let defbot = this.getdefSet('bot')
    bot = { ...defbot, ...bot }
    bot.platform = this.getConfig('qq').platform
    /** 设置data目录，防止pm2运行时目录不对 */
    bot.data_dir = process.cwd() + '/data/icqq/' + this.qq || ''

    if (!bot.ffmpeg_path) delete bot.ffmpeg_path
    if (!bot.ffprobe_path) delete bot.ffprobe_path

    return bot
  }

  get other () {
    return this.getConfig('other')
  }

  get redis () {
    return this.getConfig('redis')
  }

  get renderer() {
    return this.getConfig('renderer');
  }

  get notice() {
    return this.getConfig('notice');
  }

  /** 主人qq */
  get masterQQ () {
    let masterQQ = this.getConfig('other').masterQQ || []

    if (Array.isArray(masterQQ)) {
      masterQQ.forEach(qq => { qq = String(qq) })
    } else {
      masterQQ = [String(masterQQ)]
    }
    return masterQQ
  }

  /** package.json */
  get package () {
    if (this._package) return this._package

    this._package = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
    return this._package
  }

  /** 群配置 */
  getGroup (groupId = '') {
    let config = this.getConfig('group')
    let defCfg = this.getdefSet('group')
    if (config[groupId]) {
      return { ...defCfg.default, ...config.default, ...config[groupId] }
    }
    return { ...defCfg.default, ...config.default }
  }

  /** other配置 */
  getOther () {
    let def = this.getdefSet('other')
    let config = this.getConfig('other')
    return { ...def, ...config }
  }

  /** notice配置 */
  getNotice () {
    let def = this.getdefSet('notice')
    let config = this.getConfig('notice')
    return { ...def, ...config }
  }

  /**
   * @param app  功能
   * @param name 配置文件名称
   */
  getdefSet (name) {
    return this.getYaml('default_config', name)
  }

  /** 用户配置 */
  getConfig (name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml (type, name) {
    let file = `./config/${type}/${name}.yaml`
    let key = `${type}.${name}`
    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /** 监听配置文件 */
  watch (file, name, type = 'default_config') {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      logger.mark(`[修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })

    this.watcher[key] = watcher
  }

  change_qq () {
    if (process.argv.includes('login') || !this.qq) return
    logger.info('修改机器人QQ或密码，请手动重启')
  }

  async change_bot () {
    /** 修改日志等级 */
    let log = await import('./log.js')
    log.default()
  }
}

export default new Cfg()
