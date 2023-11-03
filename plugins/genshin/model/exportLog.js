import base from './base.js'
import cfg from '../../../lib/config/config.js'
import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import moment from 'moment'
import GachaLog from './gachaLog.js'
import lodash from 'lodash'

let xlsx = {}

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

  async initXlsx() {
    if (!lodash.isEmpty(xlsx)) return xlsx

    xlsx = await import('node-xlsx')
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

    await this.e.friend.sendFile(saveFile).catch((err) => {
      logger.error(`${this.e.logFnc} 发送文件失败 ${JSON.stringify(err)}`)
    })

    /** 删除文件 */
    fs.unlink(saveFile, () => { })
  }

  async exportXlsx() {
    await this.getUid()

    if (!this.uid) return false

    await this.initXlsx()

    logger.mark(`${this.e.logFnc} 开始导出${this.uid}.xlsx`)

    let res = this.getAllList()

    /** 处理卡池数据 */
    let xlsxData = this.xlsxDataPool(res)
    /** 处理所有数据 */
    xlsxData.push(this.xlsxDataAll(res))

    /** node-xlsx导出的buffer有点大.. */
    let buffer = xlsx.build(xlsxData)
    let saveFile = `${this.path}${this.uid}/${this.uid}.xlsx`

    fs.writeFileSync(saveFile, Buffer.from(buffer))

    logger.mark(`${this.e.logFnc} 导出成功${this.uid}.xlsx`)

    this.e.reply(`记录文件${this.uid}.xlsx上传中，请耐心等待...`)

    res = await this.e.friend.sendFile(saveFile).catch((err) => {
      this.e.reply(`发送文件${this.uid}.xlsx失败，请稍后再试`)
      logger.error(`${this.e.logFnc} 发送文件失败 ${JSON.stringify(err)}`)
    })

    let line = xlsxData[xlsxData.length - 1].data.length - 1
    if (res) this.e.reply(`${this.uid}.xlsx上传成功，共${line}条\n请接收文件`)

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

  xlsxDataPool(data) {
    let xlsxData = []

    for (let v of this.pool(this.game)) {
      let poolData = [
        [
          '时间', '名称', '物品类型', '星级', '祈愿类型'
        ]
      ]
      for (let log of data[v.type]) {
        poolData.push([
          log.time, log.name, log.item_type, log.rank_type, log.gacha_type
        ])
      }

      let sheetOptions = {
        '!cols': [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
      }
      xlsxData.push({ name: `${v.typeName}祈愿`, data: poolData, options: sheetOptions })
    }

    return xlsxData
  }

  xlsxDataAll(data) {
    let ui = this.e.isSr ? 'sr' : 'ui'
    let list = [
      [
        'count', 'gacha_type', 'id', 'item_id', 'item_type', 'lang', 'name', 'rank_type', 'time', 'uid', `${ui}gf_gacha_type`
      ]
    ]
    for (let v of data.list) {
      let tmp = []
      if (this.e.isSr) v.srgf_gacha_type = v.gacha_type
      for (let i of list[0]) {
        if (i == 'id' || i == `${ui}gf_gacha_type`) v[i] = String(v[i])
        tmp.push(v[i])
      }
      list.push(tmp)
    }
    let sheetOptions = {
      '!cols': [{ wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }]
    }

    return { name: '原始数据', data: list, options: sheetOptions }
  }

  /** xlsx导入抽卡记录 */
  async logXlsx() {
    await this.initXlsx()

    let uid = /[1-9][0-9]{8}/g.exec(this.e.file.name)[0]
    let textPath = `${this.path}${this.e.file.name}`
    /** 获取文件下载链接 */
    let fileUrl = await this.e.friend.getFileUrl(this.e.file.fid)

    let ret = await common.downFile(fileUrl, textPath)
    if (!ret) {
      this.e.reply('下载xlsx文件错误')
      return false
    }

    let list = xlsx.parse(textPath)
    list = lodash.keyBy(list, 'name')

    // 适配StarRailExport导出的xlsx，该xlsx没有原始数据表.
    let rawData = list['原始数据'] ? list['原始数据'] : list['rawData'];
    if (!list['原始数据'] && list['rawData']) {
      // 获取rawData的time字段（第9列）的索引
      const timeIndex = 8;

      // 对rawData进行排序（按照time字段，除第一行外）
      const headerRow = rawData.data[0]; // 保存标题行
      const dataToSort = rawData.data.slice(1); // 除第一行外的数据

      dataToSort.sort((a, b) => {
        return moment(a[timeIndex]).format('x') - moment(b[timeIndex]).format('x');
      });

      // 重新构建rawData的数据，包括标题行
      rawData.data = [headerRow, ...dataToSort];

      // 将数据写回原文件，重新读取
      fs.writeFileSync(textPath, xlsx.build([rawData]));
      list = lodash.keyBy(xlsx.parse(textPath), 'name');
      rawData = list['rawData'];
    }

    if (!rawData) {
      this.e.reply('xlsx文件内容错误：非统一祈愿记录标准')
      return false
    }

    if (rawData.data[0].includes('srgf_gacha_type')) {
      this.e.isSr = true
      this.game = 'sr'
    }
    /** 处理xlsx数据 */
    let data = this.dealXlsx(rawData.data);
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

  dealXlsx(list) {
    let ui = this.e.isSr ? 'sr' : 'ui'
    /** 必要字段 */
    let reqField = ['gacha_type', 'item_type', 'name', 'time', `${ui}gf_gacha_type`]
    /** 不是必要字段 */
    let noReqField = ['id', 'uid', 'count', 'item_id', 'lang', 'rank_type']

    let field = {}
    for (let i in list[0]) {
      field[list[0][i]] = i
    }

    /** 判断字段 */
    for (let v of reqField) {
      if (!field[v]) {
        let tips = v === 'srgf_gacha_type' ? '\n请在【原始数据】工作表复制【gacha_type】列，粘贴并把此标题重命名为【srgf_gacha_type】' : ''
        this.e.reply(`xlsx文件内容错误：缺少必要字段${v}${tips}`)
        return
      }
    }

    /** 倒序 */
    if (moment(list[1][field.time]).format('x') < moment(list[list.length - 1][field.time]).format('x')) {
      list = list.reverse()
    }

    let data = {}
    for (let v of list) {
      if (v[field.name] == 'name') continue
      if (!data[v[field[`${ui}gf_gacha_type`]]]) data[v[field[`${ui}gf_gacha_type`]]] = []

      let tmp = {}
      /** 加入必要字段 */
      for (let re of reqField) {
        tmp[re] = v[field[re]]
      }

      /** 加入非必要字段 */
      for (let noRe of noReqField) {
        if (field[noRe]) {
          tmp[noRe] = v[field[noRe]]
        } else {
          tmp[noRe] = ''
        }
      }

      data[v[field[`${ui}gf_gacha_type`]]].push(tmp)
    }

    return data
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
