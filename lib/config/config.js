import YAML from "yaml"
import fs from "node:fs"
import chokidar from "chokidar"
import _ from "lodash"
import EventEmitter from "node:events"

/** 配置文件 */
export default new class Cfg {
  constructor() {
    this.config = {}
    this.watcher = {}
    this.initCfg()

    if (this.getAllCfg("bot").file_watch === false) {
      const FSWatcher = Object.assign(new EventEmitter, {
        on() { return this }, addListener() { return this },
        start() {}, close() {}, ref() { return this }, unref() { return this },
      })
      fs.watch = () => FSWatcher
      chokidar.watch = () => FSWatcher

      for (const i in this.watcher) {
        this.watcher[i].close()
        delete this.watcher[i]
      }
      this.watch = () => {}
    }

    return new Proxy(this, {
      get: (target, prop) => target[prop] ?? target.getAllCfg(String(prop)),
    })
  }

  /** 初始化配置 */
  initCfg() {
    const path = "config/config/"
    const pathDef = "config/default_config/"
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith(".yaml"))
    for (const file of files)
      if (!fs.existsSync(`${path}${file}`))
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
    for (const i of ["data", "temp"])
      if (!fs.existsSync(i))
        fs.mkdirSync(i)
  }

  /** 主人账号 */
  get masterQQ() {
    const other = this.getAllCfg("other")
    if (other.masterQQs) return other.masterQQs
    let masterQQ = other.masterQQ || []

    if (!Array.isArray(masterQQ))
      masterQQ = [masterQQ]

    return this.config["config.other"].masterQQs = masterQQ.map(i => Number(i) || i)
  }

  /** Bot账号:[主人帐号] */
  get master() {
    const other = this.getAllCfg("other")
    if (other.masters) return other.masters
    let master = other.master || []

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
    return this.config["config.other"].masters = masters
  }

  /** 机器人账号 */
  get uin() {
    return Object.keys(this.master)
  }
  get qq() {
    return this.uin
  }

  /** package.json */
  get package() {
    if (this._package) return this._package
    return this._package = JSON.parse(fs.readFileSync("package.json", "utf8"))
  }

  /** 群配置 */
  getGroup(bot_id = "", group_id = "") {
    const config = this.getAllCfg("group")
    return {
      ...config.default,
      ...config[`${bot_id}:default`],
      ...config[group_id],
      ...config[`${bot_id}:${group_id}`],
    }
  }

  /** other配置 */
  getOther() {
    return this.getAllCfg("other")
  }

  /**
   * @param app  功能
   * @param name 配置文件名称
   */
  getdefSet(name) {
    return this.getYaml("default_config", name)
  }

  /** 用户配置 */
  getConfig(name) {
    return this.getYaml("config", name)
  }

  getAllCfg(name) {
    return {
      ...this.getdefSet(name),
      ...this.getConfig(name),
    }
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml(type, name) {
    const key = `${type}.${name}`
    if (key in this.config) return this.config[key]
    const file = `config/${type}/${name}.yaml`

    try {
      this.config[key] = YAML.parse(fs.readFileSync(file, "utf8"))
    } catch (err) {
      Bot.makeLog("trace", ["读取配置文件", file, "错误", err], "Config")
      return this.config[key] = undefined
    }

    this.watch(file, name, type)
    return this.config[key]
  }

  /** 监听配置文件 */
  watch(file, name, type = "default_config") {
    const key = `${type}.${name}`
    if (this.watcher[key]) return

    this.watcher[key] = chokidar.watch(file)
    this.watcher[key].on("change", _.debounce(() => {
      delete this.config[key]
      if (typeof Bot !== "object") return
      Bot.makeLog("mark", `[修改配置文件][${type}][${name}]`, "Config")
      if (`change_${name}` in this)
        this[`change_${name}`]()
    }, 5000))
  }

  async change_bot() {
    /** 修改日志等级 */
    (await import("./log.js")).default()
  }
}