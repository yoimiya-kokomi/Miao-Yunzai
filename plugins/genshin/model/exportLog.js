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

    const gsPool = [
      { type: 301, typeName: '角色活动' },
      { type: 302, typeName: '武器活动' },
      { type: 200, typeName: '常驻' }
    ];

    const srPool = [
      { type: 11, typeName: '角色活动' },
      { type: 12, typeName: '武器活动' },
      { type: 2, typeName: '新手活动' },
      { type: 1, typeName: '常驻' }
    ];

    this.pool = this.e.isSr ? srPool : gsPool;

    const gsTypeName = {
      301: '角色',
      302: '武器',
      200: '常驻'
    };

    const srTypeName = {
      11: '角色',
      12: '武器',
      2: '新手',
      1: '常驻'
    };

    this.typeName = this.e.isSr ? srTypeName : gsTypeName;
  }

  async initXlsx() {
    if (!lodash.isEmpty(xlsx)) return xlsx

    xlsx = await import('node-xlsx')
  }

  async exportJson() {
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
        uigf_version: 'v2.2'
      },
      list
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
    let res = {
      list: []
    }
    let tmpId = {}
    for (let v of this.pool) {
      let json = `${this.path}${this.uid}/${v.type}.json`
      if (fs.existsSync(json)) {
        json = JSON.parse(fs.readFileSync(json, 'utf8'))
        json = json.reverse()
      } else {
        json = []
      }
      res[v.type] = json
      for (let v of json) {
        if (v.gacha_type == 301 || v.gacha_type == 400) {
          v.uigf_gacha_type = '301'
        } else {
          v.uigf_gacha_type = v.gacha_type
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

    for (let v of this.pool) {
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
    let list = [
      [
        'count', 'gacha_type', 'id', 'item_id', 'item_type', 'lang', 'name', 'rank_type', 'time', 'uid', 'uigf_gacha_type'
      ]
    ]
    for (let v of data.list) {
      let tmp = []
      for (let i of list[0]) {
        if (i == 'id' || i == 'uigf_gacha_type') v[i] = String(v[i])
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

    /** 处理xlsx数据 */
    let data = this.dealXlsx(rawData.data);
    if (!data) return false

    /** 保存json */
    let msg = []
    for (let type in data) {
      if (!this.typeName[type]) continue
      let gachLog = new GachaLog(this.e)
      gachLog.uid = uid
      gachLog.type = type
      gachLog.writeJson(data[type])

      msg.push(`${this.typeName[type]}记录：${data[type].length}条`)
    }

    /** 删除文件 */
    fs.unlink(textPath, () => { })

    await this.e.reply(`${this.e.file.name}，导入成功\n${msg.join('\n')}`)
  }

  dealXlsx(list) {
    /** 必要字段 */
    let reqField = ['uigf_gacha_type', 'gacha_type', 'item_type', 'name', 'time']
    /** 不是必要字段 */
    let noReqField = ['id', 'uid', 'count', 'item_id', 'lang', 'rank_type']

    let field = {}
    for (let i in list[0]) {
      field[list[0][i]] = i
    }

    // 适配StarRailExport导出的xlsx，该xlsx没有uigf_gacha_type字段.
    if (!field['uigf_gacha_type'] && field['gacha_type']) {
      field['uigf_gacha_type'] = field['gacha_type']
    }

    /** 判断字段 */
    for (let v of reqField) {
      if (!field[v]) {
        this.e.reply(`xlsx文件内容错误：缺少必要字段${v}`)
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
      if (!data[v[field.uigf_gacha_type]]) data[v[field.uigf_gacha_type]] = []

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

      data[v[field.uigf_gacha_type]].push(tmp)
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

    let data = this.dealJson(json.list)
    if (!data) return false

    /** 保存json */
    let msg = []
    for (let type in data) {
      if (!this.typeName[type]) continue
      let gachLog = new GachaLog(this.e)
      gachLog.uid = uid
      gachLog.type = type
      gachLog.writeJson(data[type])

      msg.push(`${this.typeName[type]}记录：${data[type].length}条`)
    }

    /** 删除文件 */
    fs.unlink(textPath, () => { })

    await this.e.reply(`${this.e.file.name}，导入成功\n${msg.join('\n')}`)
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

    // 对json进行排序（按照time字段）
    list.sort((a, b) => {
      return moment(a.time).format('x') - moment(b.time).format('x');
    });

    /** 倒序 */
    if (moment(list[0].time).format('x') < moment(list[list.length - 1].time).format('x')) {
      list = list.reverse()
    }

    for (let v of list) {
      // 适配StarRailExport导出的json，该json没有uigf_gacha_type字段.
      if (!v['uigf_gacha_type'] && v['gacha_type']) {
        v['uigf_gacha_type'] = v['gacha_type']
      }
      
      if (!data[v.uigf_gacha_type]) data[v.uigf_gacha_type] = []
      data[v.uigf_gacha_type].push(v)
    }

    return data
  }
}
