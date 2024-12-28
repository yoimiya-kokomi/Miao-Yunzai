import fs from "node:fs/promises"
import YAML from "yaml"
import _ from "lodash"
export default async function(name, config = {}, keep = {}) {
  const configFile = `config/${name}.yaml`
  const configSave = () => fs.writeFile(configFile, YAML.stringify(config), "utf8")

  let configData
  try {
    configData = YAML.parse(await fs.readFile(configFile, "utf8"))
    _.merge(config, configData)
  } catch (err) {
    logger.debug("配置文件", configFile, "读取失败", err)
  }
  _.merge(config, keep)

  if (YAML.stringify(config) != YAML.stringify(configData))
    await configSave()
  return { config, configSave }
}