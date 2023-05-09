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

  async saveDB (mys) {
    if (!mys.ck || !mys.device || !mys.db) {
      return false
    }
    let db = this
    this.ck = mys.ck
    this.type = mys.type
    this.device = mys.device
    this.gsUids = (mys.gsUids || []).join(',')
    this.srUids = (mys.srUids || []).join(',')
    await db.save()
  }
}

BaseModel.initDB(MysUserDB, COLUMNS)
await MysUserDB.sync()

export default MysUserDB
