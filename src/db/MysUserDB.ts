import BaseModel from './BaseModel.js'
import { DataTypes } from 'sequelize'

/**
 *
 */
const COLUMNS = {
  // 用户ID，qq为数字
  ltuid: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },

  // MysUser类型，mys / hoyolab
  type: {
    type: DataTypes.STRING,
    defaultValue: 'mys',
    notNull: true
  },

  // CK
  ck: DataTypes.STRING,
  device: DataTypes.STRING,
  uids: {
    type: DataTypes.STRING,
    get() {
      let data = this.getDataValue('uids')
      let ret = {}
      try {
        ret = JSON.parse(data)
      } catch (e) {
        ret = {}
      }
      return ret
    },
    set(uids) {
      this.setDataValue('uids', JSON.stringify(uids))
    }
  }
}

/**
 *
 */
class MysUserDB extends BaseModel {
  ck = null
  type = null
  device = null
  uids = null

  static async find(ltuid = '', create = false) {
    // DB查询
    let mys = await MysUserDB.findByPk(ltuid)
    if (!mys && create) {
      mys = await MysUserDB.build({
        ltuid
      })
    }
    return mys || false
  }

  async saveDB(mys) {
    if (!mys.ck || !mys.device || !mys.db) {
      return false
    }
    let db = this
    this.ck = mys.ck
    this.type = mys.type
    this.device = mys.device
    this.uids = mys.uids
    await db.save()
  }
}

/**
 *
 */
BaseModel.initDB(MysUserDB, COLUMNS)

/**
 *
 */
await MysUserDB.sync()

/**
 *
 */
export default MysUserDB
