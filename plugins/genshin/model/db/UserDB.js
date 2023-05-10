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

  ltuids: Types.STRING
}

class UserDB extends BaseModel {
  static async find (id, type = 'qq') {
    // user_id
    id = type === 'qq' ? '' + id : type + id
    // DB查询
    let user = await UserDB.findByPk(id, {
      include: {
        model: UserGameDB,
        as: 'games'
      }
    })
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
    let games = []
    await MysUtil.eachGame(async (key) => {
      let game = user.games[key]
      if (!game && (user.uid[key] || !lodash.isEmpty(user.uidMap[key]))) {
        game = await db.createGame({
          game: key
        })
      }
      if (game) {
        game.uid = user.uid[key]
        game.data = user.uidMap[key]
        games.push(game)
        await game.save()
      }
    })
    if (games.length > 0) {
      await this.setGames(games)
    }
    await this.save()
  }
}

BaseModel.initDB(UserDB, COLUMNS)
await UserDB.sync()

export default UserDB