import base from './base.js'
import cfg from '../../../lib/config/config.js'
import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import moment from 'moment'
import GachaLog from './gachaLog.js'
import lodash from 'lodash'

export default class ExportLog extends base {
  constructor(e) {
    super(e)
    this.model = 'gachaLog'

    this.urlKey = `${this.prefix}url:`
    /** 绑定的uid */
    this.uidKey = `Yz:genshin:mys:qq-uid:${this.userId}`

    this.path = this.e.isSr ? `./data/srJson/${this.e.user_id}/` : `./data/gachaJson/${this.e.user_id}/`

    this.game = this.e.game

    this.pool = (game = 'gs') => {
      let pool = {
        gs: [
          { type: 301, typeName: '角色活动' },
          { type: 302, typeName: '武器活动' },
          { type: 200, typeName: '常驻' }
        ],
        sr: [
          { type: 11, typeName: '角色活动' },
          { type: 12, typeName: '武器活动' },
          { type: 2, typeName: '新手活动' },
          { type: 1, typeName: '常驻' }
        ]
      }
      return pool[game]
    }

    this.typeName = (game = 'gs') => {
      let type = {
        gs: {
          301: '角色',
          302: '武器',
          200: '常驻'
        },
        sr: {
          11: '角色',
          12: '武器',
          2: '新手',
          1: '常驻'
        }
      }
      return type[game]
    }
  }

  async exportJson() {
    if (!this.e.isSr) {
      await common.downFile('https://api.uigf.org/dict/genshin/chs.json', './temp/uigf/genshin.json')
    }
    await this.getUid()

    if (!this.uid) return false

    let list = this.getAllList().list

    let data = {
      info: {
        uid: this.uid,
        lang: list[0].lang,
        export_time: moment().format('YYYY-MM-DD HH:mm:ss'),
        export_timestamp: moment().format('X'),
        export_app: 'Miao-Yunzai',
        export_app_version: cfg.package.version,
      },
      list
    }

    if (this.e.isSr) {
      data.info.srgf_version = 'v1.0'
      data.info.region_time_zone = moment(list[0].time).utcOffset() / 60
    } else {
      data.info.uigf_version = 'v2.3'
    }

    let saveFile = `${this.path}${this.uid}/${this.uid}.json`

    fs.writeFileSync(saveFile, JSON.stringify(data, '', '\t'))

    logger.mark(`${this.e.logFnc} 导出成功${this.uid}.json`)

    this.e.reply(`导出成功：${this.uid}.json，共${list.length}条 \n请接收文件`)

    if (this.e.group?.sendFile)
      await this.e.group.sendFile(saveFile)
    else if (this.e.friend?.sendFile)
      await this.e.friend.sendFile(saveFile)
    else this.e.reply('导出失败：暂不支持发送文件')

    /** 删除文件 */
    fs.unlink(saveFile, () => { })
  }

  async getUid() {
    let gachLog = new GachaLog(this.e)
    let uid = await gachLog.getUid()

    if (!uid) return false

    this.uid = uid
    return this.uid
  }

  getAllList() {
    let uigf = './temp/uigf/genshin.json'
    try {
      uigf = JSON.parse(fs.readFileSync(uigf, 'utf8'))
    } catch (error) {
      uigf = false
    }
    let res = {
      list: []
    }
    let tmpId = {}
    for (let v of this.pool(this.game)) {
      let json = `${this.path}${this.uid}/${v.type}.json`
      if (fs.existsSync(json)) {
        json = JSON.parse(fs.readFileSync(json, 'utf8'))
        json = json.reverse()
      } else {
        json = []
      }
      res[v.type] = json
      for (let v of json) {
        if (!v.item_id && uigf) {
          v.item_id = String(uigf[v.name])
        }
        if (!this.e.isSr) {
          if (v.gacha_type == 301 || v.gacha_type == 400) {
            v.uigf_gacha_type = '301'
          } else {
            v.uigf_gacha_type = v.gacha_type
          }
        }
        let id = v.id
        if (!id) {
          id = moment(v.time).format('x') + '000000'
          v.id = id
        } else {
          if (id.length == 13) {
            v.id = `${id}000000`
          }
        }

        if (tmpId[id]) {
          let newId = `${id}00000${tmpId[id].length}`
          tmpId[id].push(newId)
          v.id = newId
        } else {
          tmpId[id] = [id]
        }
        res.list.push(v)
      }
    }
    res.list = lodash.orderBy(res.list, ['id', 'asc'])
    return res
  }

  loadJson(json) {
    if (!fs.existsSync(json)) return []
    return JSON.parse(fs.readFileSync(json, 'utf8'))
  }

  /** json导入抽卡记录 */
  async logJson() {
    let uid = /[1-9][0-9]{8}/g.exec(this.e.file.name)[0]
    let textPath = `${this.path}${this.e.file.name}`
    /** 获取文件下载链接 */
    let fileUrl = await this.e.friend.getFileUrl(this.e.file.fid)

    let ret = await common.downFile(fileUrl, textPath)
    if (!ret) {
      this.e.reply('下载json文件错误')
      return false
    }
    let json = {}
    try {
      json = JSON.parse(fs.readFileSync(textPath, 'utf8'))
    } catch (error) {
      this.e.reply(`${this.e.file.name},json格式错误`)
      return false
    }

    if (lodash.isEmpty(json) || !json.list) {
      this.e.reply('json文件内容错误：非统一祈愿记录标准')
      return false
    }

    if (json.info.srgf_version) {
      this.e.isSr = true
      this.game = 'sr'
    }

    let data = this.dealJson(json.list)
    if (!data) return false

    /** 保存json */
    let msg = []
    for (let type in data) {
      let typeName = this.typeName(this.game)
      if (!typeName[type]) continue
      let gachLog = new GachaLog(this.e)
      gachLog.uid = uid
      gachLog.type = type
      gachLog.writeJson(data[type])

      msg.push(`${typeName[type]}记录：${data[type].length}条`)
    }

    /** 删除文件 */
    fs.unlink(textPath, () => { })

    await this.e.reply(`${this.e.file.name}，${this.e.isSr ? '星铁' : '原神'}记录导入成功\n${msg.join('\n')}`)
  }

  dealJson(list) {
    let data = {}

    /** 必要字段 */
    let reqField = ['gacha_type', 'item_type', 'name', 'time']

    for (let v of reqField) {
      if (!list[0][v]) {
        this.e.reply(`json文件内容错误：缺少必要字段${v}`)
        return false
      }
    }

    /** 倒序 */
    if (moment(list[0].time).format('x') < moment(list[list.length - 1].time).format('x')) {
      list = list.reverse()
    }

    for (let v of list) {
      if (this.game === 'sr') v.uigf_gacha_type = v.gacha_type
      if (!data[v.uigf_gacha_type]) data[v.uigf_gacha_type] = []
      data[v.uigf_gacha_type].push(v)
    }

    return data
  }
}
