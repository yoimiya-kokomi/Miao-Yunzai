import YAML from "yaml"
import fs from "node:fs"
import chokidar from "chokidar"

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
    let path = "config/config/"
    let pathDef = "config/default_config/"
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith(".yaml"))
    for (const file of files)
      if (!fs.existsSync(`${path}${file}`))
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
    for (const i of ["data", "resources", "temp"])
      if (!fs.existsSync(i)) fs.mkdirSync(i)
  }

  /** Bot配置 */
  get bot () {
    let bot = this.getConfig("bot")
    let defbot = this.getdefSet("bot")
    bot = { ...defbot, ...bot }

    return bot
  }

  get other () {
    return this.getConfig("other")
  }

  get redis () {
    return this.getConfig("redis")
  }

  get renderer() {
    return this.getConfig("renderer");
  }

  /** 主人账号 */
  get masterQQ () {
    let masterQQ = this.getConfig("other").masterQQ || []

    if (!Array.isArray(masterQQ))
      masterQQ = [masterQQ]

    const masters = []
    for (const i of masterQQ)
      masters.push(Number(i) || String(i))
    return masters
  }

  /** Bot账号:[主人帐号] */
  get master () {
    let master = this.getConfig("other").master || []

    if (!Array.isArray(master))
      master = [master]

    const masters = {}
    for (let i of master) {
      i = i.split(":")
      const bot_id = i.shift()
      const user_id = i.join(":")
      if (Array.isArray(masters[bot_id]))
        masters[bot_id].push(user_id)
      else
        masters[bot_id] = [user_id]
    }
    return masters
  }

  /** 机器人账号 */
  get uin () {
    return Object.keys(this.master)
  }
  get qq () {
    return this.uin
  }

  /** package.json */
  get package () {
    if (this._package) return this._package

    this._package = JSON.parse(fs.readFileSync("package.json", "utf8"))
    return this._package
  }

  /** 群配置 */
  getGroup (bot_id = "", group_id = "") {
    const config = this.getConfig("group")
    const defCfg = this.getdefSet("group")
    return {
      ...defCfg.default,
      ...config.default,
      ...config[`${bot_id}:default`],
      ...config[group_id],
      ...config[`${bot_id}:${group_id}`],
    }
  }

  /** other配置 */
  getOther () {
    let def = this.getdefSet("other")
    let config = this.getConfig("other")
    return { ...def, ...config }
  }

  /**
   * @param app  功能
   * @param name 配置文件名称
   */
  getdefSet (name) {
    return this.getYaml("default_config", name)
  }

  /** 用户配置 */
  getConfig (name) {
    return this.getYaml("config", name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml (type, name) {
    let file = `config/${type}/${name}.yaml`
    let key = `${type}.${name}`
    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, "utf8")
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /** 监听配置文件 */
  watch (file, name, type = "default_config") {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on("change", path => {
      delete this.config[key]
      if (typeof Bot == "undefined") return
      logger.mark(`[修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })

    this.watcher[key] = watcher
  }

  async change_bot () {
    /** 修改日志等级 */
    let log = await import("./log.js")
    log.default()
  }
}

export default new Cfg()