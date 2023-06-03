import BaseModel from './BaseModel.js'
import lodash from 'lodash'
import { UserGameDB } from './index.js'
import MysUtil from '../mys/MysUtil.js'

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
  games: {
    type: Types.STRING,
    get () {
      let data = this.getDataValue('games')
      let ret = {}
      try {
        data = JSON.parse(data) || {}
      } catch (e) {
        data = {}
      }
      MysUtil.eachGame((game) => {
        let ds = data[game] || {}
        ret[game] = {
          uid: ds.uid || '',
          data: ds.data || {}
        }
      })
      return ret
    },
    set (data) {
      this.setDataValue('games', JSON.stringify(data))
    }
  },
  data: Types.STRING
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

  async saveDB (user) {
    let db = this
    let ltuids = []
    lodash.forEach(user.mysUsers, (mys) => {
      if (mys.ck && mys.ltuid) {
        ltuids.push(mys.ltuid)
      }
    })
    db.ltuids = ltuids.join(',')
    db.games = user._games
    await this.save()
  }
}

BaseModel.initDB(UserDB, COLUMNS)
await UserDB.sync({ alter: true })

export default UserDB