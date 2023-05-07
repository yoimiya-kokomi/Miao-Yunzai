import BaseModel from './BaseModel.js'

const { Types } = BaseModel

const COLUMNS = {
  // 用户ID，qq为数字
  ltuid: {
    type: Types.INTEGER,
    primaryKey: true
  },

  // MysUser类型，mys / hoyolab
  type: {
    type: Types.STRING,
    defaultValue: 'mys',
    notNull: true
  },

  // CK
  ck: Types.STRING,
  device: Types.STRING,

  gsUids: Types.STRING,

  srUids: Types.STRING
}

class MysUserDB extends BaseModel {
  static async find (ltuid = '', create = false) {
    // DB查询
    let mys = await MysUserDB.findByPk(ltuid)
    if (!mys && create) {
      mys = await MysUserDB.build({
        ltuid
      })
    }
    return mys || false
  }

  static async findByCK (ck = '') {
    let ltuid = 0
    let mys = await MysUserDB.find(ltuid)
    if (!mys) {
      mys = await MysUserDB.build({
        ltuid,
        ck
      })
    }
    return mys._cacheThis()
  }
}

BaseModel.initDB(MysUserDB, COLUMNS)
await MysUserDB.sync()

export default MysUserDB
