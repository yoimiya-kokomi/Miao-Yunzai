import { Sequelize, DataTypes, Model } from "sequelize"
import cfg from "../../../../lib/config/config.js"
import path from "node:path"
import fs from "node:fs/promises"

if (cfg.db.dialect === "sqlite") await fs.mkdir(path.dirname(cfg.db.storage), { recursive: true })
const sequelize = new Sequelize(cfg.db)

try {
  await sequelize.authenticate()
} catch (err) {
  logger.error("数据库认证错误", err)
}

export default class BaseModel extends Model {
  static Types = DataTypes

  static initDB(model, columns) {
    let name = model.name
    name = name.replace(/DB$/, "s")
    model.init(columns, { sequelize, tableName: name })
    model.COLUMNS = columns
  }
}
export { sequelize }
