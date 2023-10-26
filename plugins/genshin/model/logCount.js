import base from './base.js'
import lodash from 'lodash'
import fs from 'node:fs'
import gsCfg from './gsCfg.js'
import moment from 'moment'

export default class LogCount extends base {
  constructor (e) {
    super(e)
    this.model = 'logCount'

    this.urlKey = `${this.prefix}url:`
    /** 绑定的uid */
    this.uidKey = `Yz:genshin:mys:qq-uid:${this.userId}`

    this.path = `./data/gachaJson/${this.e.user_id}/`

    this.pool = [
      { type: 301, typeName: '角色' },
      { type: 302, typeName: '武器' },
      { type: 200, typeName: '常驻' }
    ]

    /** 五星角色 */
    this.role5 = ['刻晴', '莫娜', '七七', '迪卢克', '琴', '提纳里', '迪希雅']
    /** 五星武器 */
    this.weapon5 = ['阿莫斯之弓', '天空之翼', '天空之卷', '天空之脊', '天空之傲', '天空之刃', '四风原典', '和璞鸢', '狼的末路', '风鹰剑']
    if (e.isSr) {
      /** 绑定的uid */
      this.uidKey = `Yz:srJson:mys:qq-uid:${this.userId}`

      this.path = `./data/srJson/${this.e.user_id}/`
      this.pool = [
        { type: 11, typeName: '角色' },
        { type: 12, typeName: '光锥' },
        { type: 1, typeName: '常驻' },
        { type: 2, typeName: '新手' }
      ]
      /** 五星角色 */
      this.role5 = ['姬子', '杰帕德', '彦卿', '白露', '瓦尔特', '克拉拉', '布洛妮娅']
      /** 五星武器 */
      this.weapon5 = ['银河铁道之夜', '无可取代的东西', '但战斗还未结束', '以世界之名', '制胜的瞬间', '如泥酣眠', '时节不居']
    }
  }

  // 读取本地json
  readJson () {
    let logJson = []; let ids = []
    let file = `${this.path}/${this.uid}/${this.type}.json`
    if (fs.existsSync(file)) {
      // 获取本地数据 进行数据合并
      logJson = JSON.parse(fs.readFileSync(file, 'utf8'))
      for (let val of logJson) {
        if (val.id) {
          ids.push(val.id)
        }
      }
    }

    return { list: logJson, ids }
  }

  /** #抽卡统计 */
  async count () {
    /** 卡池 */
    this.getPool()

    /** 判断uid */
    await this.getUid()

    if (!this.uid) {
      await this.e.reply('当前绑定uid暂无抽卡记录')
      return false
    }

    /** 统计计算记录 */
    let data = this.analyseHistory()
    if (!data) return false

    return {
      quality: 80,
      ...this.screenData,
      ...data
    }
  }

  getPool () {
    let msg = this.e.msg.replace(/#|抽卡|记录|祈愿|分析|池|原神|星铁|崩坏星穹铁道|铁道|抽卡|统计|池/g, '')
    this.type = this.e.isSr ? 11 : 301
    this.typeName = '角色'
    switch (msg) {
      case 'up':
      case '抽卡':
      case '角色':
      case '抽奖':
        this.type = this.e.isSr ? 11 : 301
        this.typeName = '角色'
        break
      case '常驻':
        this.type = this.e.isSr ? 1 : 200
        this.typeName = '常驻'
        break
      case '武器':
        this.type = this.e.isSr ? 12 : 302
        this.typeName = this.e.isSr ? '光锥' : '武器'
        break
      case '光锥':
        this.type = 12
        this.typeName = '光锥'
        break
      case '新手':
        this.type = this.e.isSr ? 2 : 100
        this.typeName = '新手'
        break
    }
  }

  async getUid () {
    if (!fs.existsSync(this.path)) {
      this.e.reply(`暂无抽卡记录\n${this.e?.isSr ? '*' : '#'}记录帮助，查看配置说明`, false, { at: true })
      return false
    }

    let logs = fs.readdirSync(this.path)

    if (lodash.isEmpty(logs)) {
      this.e.reply(`暂无抽卡记录\n${this.e?.isSr ? '*' : '#'}记录帮助，查看配置说明`, false, { at: true })
      return false
    }

    if (!this.uid) {
      this.e.at = false
      this.uid = this?.e?.isSr ? this.e.user?._games?.sr?.uid : this.e.user?._games?.gs?.uid || await this.e.runtime.getUid(this.e) || await redis.get(this.uidKey)
    }

    /** 记录有绑定的uid */
    if (this.uid && logs.includes(String(this.uid))) {
      return this.uid
    }

    /** 拿修改时间最后的uid */
    let uidArr = []
    for (let uid of logs) {
      let json = `${this.path}${uid}/301.json`
      if (!fs.existsSync(json)) {
        continue
      }

      let tmp = fs.statSync(json)
      uidArr.push({
        uid,
        mtimeMs: tmp.mtimeMs
      })
    }
    if (uidArr.length <= 0) {
      return false
    }

    uidArr = uidArr.sort(function (a, b) {
      return b.mtimeMs - a.mtimeMs
    })

    this.uid = uidArr[0].uid

    return uidArr[0].uid
  }

  getPoolCfg () {
    let poolCfg = gsCfg.getdefSet('pool', this.type)

    poolCfg.forEach(v => {
      v.start = moment(v.from, 'YYYY-MM-DD HH:mm:ss').format('X')
      v.end = moment(v.to, 'YYYY-MM-DD HH:mm:ss').format('X')
    })

    return poolCfg
  }

  /** 统计计算记录 */
  analyseHistory () {
    let all = this.readJson().list

    all = all.reverse()

    let poolCfg = [...this.getPoolCfg()].reverse()

    let sortName
    if (this.type == 301) {
      sortName = gsCfg.getdefSet('role', 'other').sortName
    } else {
      sortName = gsCfg.getdefSet('weapon', 'other').sortName
    }

    let pool = {}
    let fiveNum = 0
    let fourNum = 0

    for (let row of all) {
      // 判断属于卡池
      let time = moment(row.time).format('X')

      /* eslint-disable no-labels */
      b: for (let i in poolCfg) {
        if (time >= poolCfg[i].start && time <= poolCfg[i].end) {
          if (!pool[poolCfg[i].start]) {
            pool[poolCfg[i].start] = {
              count: 1,
              list: [],
              name: poolCfg[i].name,
              five: poolCfg[i].five,
              start: moment(poolCfg[i].from, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD'),
              end: moment(poolCfg[i].to, 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD')
            }
          } else {
            pool[poolCfg[i].start].count++
          }
          if (row.rank_type == 5) {
            if (row.name != '未知') {
              pool[poolCfg[i].start].list.push({
                name: row.name,
                rank_type: row.rank_type,
                item_type: row.item_type,
                time,
                num: fiveNum + 1
              })
            }
            fiveNum = 0
            fourNum++
          } else if (row.rank_type == 4) {
            pool[poolCfg[i].start].list.push({
              name: row.name,
              rank_type: row.rank_type,
              item_type: row.item_type,
              time,
              num: fourNum + 1
            })
            fourNum = 0
            fiveNum++
          } else {
            fiveNum++
            fourNum++
          }
          break b
        } else {
          delete poolCfg[i]
        }
      }
    }

    let tmp = []
    for (let i in pool) {
      tmp.push(pool[i])
    }
    pool = tmp.reverse()

    if (pool.length <= 0) {
      return false
    }

    let line = 0
    let res = []
    for (let i in pool) {
      line++
      pool[i].role = {}

      pool[i].five = pool[i].five
        .map((v) => sortName[v] ?? v)
        .join('、')
      for (let val of pool[i].list) {
        if (!pool[i].role[val.name]) {
          pool[i].role[val.name] = {
            name: val.name,
            rank_type: val.rank_type,
            item_type: val.item_type,
            count: 1
          }
        } else {
          pool[i].role[val.name].count++
        }
      }
      delete pool[i].list

      // 排序
      for (let j in pool[i].role) {
        let sort = (pool[i].role[j].rank_type - 3) * 1000 + pool[i].role[j].count
        if (this.role5.includes(pool[i].role[j].name)) {
          sort--
        }
        if (this.weapon5.includes(pool[i].role[j].name)) {
          sort--
        }
        if (pool[i].role[j].item_type == '角色' && pool[i].role[j].rank_type == 5) {
          sort += 1000
        }
        pool[i].role[j].sort = sort
      }

      pool[i].roleNum = Object.keys(pool[i].role).length
      pool[i].role = lodash.orderBy(pool[i].role, ['sort'], ['desc'])

      res.push(pool[i])
      line += Math.ceil(pool[i].roleNum / 6)

      if (this.e.isGroup && line >= 12) {
        break
      }
    }

    // if (line - pool.length <= 0) {
    //   return false;
    // }

    return {
      saveId: this.uid,
      uid: this.uid,
      pool: res,
      typeName: this.typeName,
      isGroup: this.e.isGroup
    }
  }
}
