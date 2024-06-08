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
  uids: {
    type: Types.STRING,
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

class MysUserDB extends BaseModel {
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

BaseModel.initDB(MysUserDB, COLUMNS)
await MysUserDB.sync()

export default MysUserDB
