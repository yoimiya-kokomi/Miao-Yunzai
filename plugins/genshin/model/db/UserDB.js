import BaseModel from './BaseModel.js'

const { Types } = BaseModel

const COLUMNS = {
  // 用户ID，qq为数字
  id: {
    type: Types.STRING,
    autoIncrement: false,
    primaryKey: true
  },

  type: {
    type: Types.STRING,
    defaultValue: 'qq',
    notNull: true
  },

  // 昵称
  name: Types.STRING,

  // 头像
  face: Types.STRING,

  ltuids: Types.STRING,

  // 原神UID
  gsUid: Types.STRING,
  gsRegUids: Types.STRING,

  // 星铁UID
  srUid: Types.STRING,
  srRegUids: Types.STRING
}

class UserDB extends BaseModel {
  static async find (id, type = 'qq') {
    // user_id
    id = type === 'qq' ? '' + id : type + id
    // DB查询
    let user = await UserDB.findByPk(id)
    if (!user) {
      user = await UserDB.build({
        id,
        type
      })
    }
    return user
  }
}

BaseModel.initDB(UserDB, COLUMNS)
await UserDB.sync()

export default UserDB