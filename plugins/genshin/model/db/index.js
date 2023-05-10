import UserDB from './UserDB.js'
import MysUserDB from './MysUserDB.js'
import UserGameDB from './UserGameDB.js'


UserDB.belongsToMany(MysUserDB, {
  through: 'UserLtuids'
})
MysUserDB.belongsToMany(UserDB, {
  through: 'UserLtuids'
})

UserDB.hasMany(UserGameDB, {
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
  foreignKey: 'userId',
  as: 'games'
})
UserGameDB.belongsTo(UserDB, {
  foreignKey: 'userId',
  as: 'games'
})

export { UserDB, MysUserDB, UserGameDB }