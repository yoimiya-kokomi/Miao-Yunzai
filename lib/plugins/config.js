import fs from "node:fs/promises"
import YAML from "yaml"
import _ from "lodash"
import chokidar from "chokidar"
const map = new Map()

/**
 * 监听配置文件变化
 * @this {object} config 配置对象
 * @this {string} configFile 配置文件路径
 */
export async function watcher() {
  try {
    logger.debug("配置文件", this.configFile, "发生变化")
    const configData = YAML.parse(await fs.readFile(this.configFile, "utf8"))
    _.merge(this.config, configData)
  } catch (err) {
    logger.error("配置文件", this.configFile, "读取失败", err)
  }
}

/**
 * 创建配置文件
 * @param {string} name 配置文件名
 * @param {object} config 配置文件默认值
 * @param {object} keep 保持不变的配置
 * @param {object} opts 配置选项
 * @param {boolean} opts.watch 是否监听配置文件变化
 * @param {function} opts.replacer 配置文本替换函数
 * @returns {Promise<{config: object, configSave: function}>}
 */
export default async function makeConfig(name, config = {}, keep = {}, opts = {}) {
  if (map.has(name)) return map.get(name)

  const configFile = `config/${name}.yaml`
  const configSave = _.debounce(
    typeof opts.replacer === "function"
      ? async () => fs.writeFile(configFile, await opts.replacer(YAML.stringify(config)), "utf8")
      : () => fs.writeFile(configFile, YAML.stringify(config), "utf8"),
    5000,
  )

  let configData
  try {
    configData = YAML.parse(await fs.readFile(configFile, "utf8"))
    _.merge(config, configData)
  } catch (err) {
    logger.debug("配置文件", configFile, "读取失败", err)
  }
  _.merge(config, keep)

  if (YAML.stringify(config) != YAML.stringify(configData)) await configSave()

  const ret = { config, configSave, configFile }
  map.set(name, ret)

  if (typeof opts.watch === "boolean" ? opts.watch : true)
    ret.watcher = chokidar.watch(configFile).on("change", _.debounce(watcher.bind(ret), 5000))

  return ret
}
