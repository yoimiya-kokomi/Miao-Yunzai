import UserDB from './UserDB.js'
import MysUserDB from './MysUserDB.js'


UserDB.belongsToMany(MysUserDB, {
  through: 'UserLtuids'
})
MysUserDB.belongsToMany(UserDB, {
  through: 'UserLtuids'
})

export { UserDB, MysUserDB }