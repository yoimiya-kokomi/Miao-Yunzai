import { Sequelize, DataTypes, Model } from 'sequelize'
import { Data } from '#miao'

Data.createDir('/data/db', 'root')
let dbPath = process.cwd() + '/data/db/data.db'

// TODO DB自定义
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
})
try {
  await sequelize.authenticate();
  logger.info(`[${logger.green('DB 数据库')}] > [${logger.green('连接成功')}]`);
} catch (error) {
  logger.error(`[${logger.red('DB 数据库')}] > [${logger.red('连接错误')}]`, error);
}

await sequelize.authenticate()

export default class BaseModel extends Model {
  static Types = DataTypes

  static initDB (model, columns) {
    let name = model.name
    name = name.replace(/DB$/, 's')
    model.init(columns, { sequelize, tableName: name })
    model.COLUMNS = columns
  }
}
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`[${logger.red('DB 异常')}]`, reason);
});
export { sequelize }
