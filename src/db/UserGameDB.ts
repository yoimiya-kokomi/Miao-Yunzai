import BaseModel from './BaseModel.js'
import lodash from 'lodash'

const { Types } = BaseModel

const COLUMNS = {
  // 用户ID，qq为数字
  userId: {
    type: Types.STRING
  },
  game: Types.STRING,
  uid: Types.STRING,
  data: {
    type: Types.STRING,
    get () {
      let data = this.getDataValue('data')
      let ret = {}
      try {
        data = JSON.parse(data)
      } catch (e) {
        data = []
      }
      lodash.forEach(data, (ds) => {
        if (ds.uid) {
          ret[ds.uid] = ds
        }
      })
      return ret
    },
    set (data) {
      this.setDataValue('data', JSON.stringify(lodash.values(data)))
    }
  }
}

class UserGameDB extends BaseModel {

}

BaseModel.initDB(UserGameDB, COLUMNS)
await UserGameDB.sync()

export default UserGameDB