import { Sequelize, DataTypes, Model } from 'sequelize'
import { Data } from '../miao.js'
import { join } from 'path'

/**
 * 创建路径
 */
Data.createDir('/data/db', 'root')

/**
 * DB自定义
 */
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(process.cwd(), '/data/db/data.db'),
  logging: false
})

/**
 * 校验连接
 */
await sequelize.authenticate()

/**
 *
 */
export default class BaseModel extends Model {
  static Types = DataTypes

  static initDB(model, columns) {
    let name = model.name
    name = name.replace(/DB$/, 's')
    model.init(columns, { sequelize, tableName: name })
    model.COLUMNS = columns
  }
}

/**
 *
 */
export { sequelize }
