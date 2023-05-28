import base from './base.js'
import gsCfg from './gsCfg.js'
import lodash from 'lodash'
import fs from 'node:fs'
import common from '../../../lib/common/common.js'
import MysInfo from './mys/mysInfo.js'
import NoteUser from './mys/NoteUser.js'
import MysUser from './mys/MysUser.js'
import MysUtil from './mys/MysUtil.js'
import { promisify } from 'node:util'
import YAML from 'yaml'
import { Data } from '#miao'

export default class User extends base {
  constructor (e) {
    super(e)
    this.model = 'bingCk'
    /** 绑定的uid */
    this.uidKey = `Yz:genshin:mys:qq-uid:${this.userId}`

    /** 多角色uid */
    this.allUid = []
    if (this.e.isSr) {
      /** 绑定的uid */
      this.uidKey = `Yz:srJson:mys:qq-uid:${this.userId}`
    }
  }

  // 获取当前user实例
  async user () {
    return await NoteUser.create(this.e)
  }

  async resetCk () {
    let user = await this.user()
    await user.initCache()
  }

  /** 绑定ck */
  async bing () {
    let user = await this.user()
    let set = gsCfg.getConfig('mys', 'set')

    if (this.ck && !this.e.ck) {
      this.e.ck = this.ck
    }
    if (!this.e.ck) {
      await this.e.reply(`请【私聊】发送米游社cookie，获取教程：\n${set.cookieDoc}`)
      return
    }

    let ckStr = this.e.ck.replace(/#|'|"/g, '')
    let param = {}
    ckStr.split(';').forEach((v) => {
      // 处理分割特殊cookie_token
      let tmp = lodash.trim(v).replace('=', '~').split('~')
      param[tmp[0]] = tmp[1]
    })

    if (!param.cookie_token && !param.cookie_token_v2) {
      await this.e.reply('发送cookie不完整\n请退出米游社【重新登录】，刷新完整cookie')
      return
    }

    // TODO：独立的mys数据，不走缓存ltuid
    let mys = await MysUser.create(param.ltuid)
    let data = {}
    data.ck = `ltoken=${param.ltoken};ltuid=${param.ltuid || param.login_uid};cookie_token=${param.cookie_token || param.cookie_token_v2}; account_id=${param.ltuid || param.login_uid};`
    let flagV2 = false

    if (param.cookie_token_v2 && (param.account_mid_v2 || param.ltmid_v2)) { //
      // account_mid_v2 为版本必须带的字段，不带的话会一直提示绑定cookie失败 请重新登录
      flagV2 = true
      data.ck = `ltuid=${param.ltuid || param.login_uid};account_mid_v2=${param.account_mid_v2};cookie_token_v2=${param.cookie_token_v2};ltoken_v2=${param.ltoken_v2};ltmid_v2=${param.ltmid_v2};`
    }
    if (param.mi18nLang) {
      data.ck += ` mi18nLang=${param.mi18nLang};`
    }
    /** 拼接ck */
    data.ltuid = param.ltuid || param.ltmid_v2

    /** 米游币签到字段 */
    data.login_ticket = param.login_ticket ?? ''

    mys.setCkData(data)

    /** 检查ck是否失效 */
    let uidRet = await mys.reqMysUid()
    if (uidRet.status !== 0) {
      logger.mark(`绑定cookie错误1：${this.checkMsg || 'cookie错误'}`)
      // 清除mys数据
      mys._delCache()
      return await this.e.reply(`绑定cookie失败：${this.checkMsg || 'cookie错误'}`)
    }

    if (flagV2) {
      // 获取米游社通行证id
      let userFullInfo = await mys.getUserFullInfo()
      if (userFullInfo?.data?.user_info) {
        let userInfo = userFullInfo?.data?.user_info
        // this.ltuid = userInfo.uid
        // this.ck = `${this.ck}ltuid=${this.ltuid};`
      } else {
        logger.mark(`绑定cookie错误2：${userFullInfo.message || 'cookie错误'}`)
        return await this.e.reply(`绑定cookie失败：${userFullInfo.message || 'cookie错误'}`)
      }
    }

    logger.mark(`${this.e.logFnc} 检查cookie正常 [ltuid:${mys.ltuid}]`)

    await user.addMysUser(mys)
    await mys.initCache()
    await user.save()

    logger.mark(`${this.e.logFnc} 保存cookie成功 [ltuid:${mys.ltuid}]`)

    let uidMsg = [`绑定cookie成功`]
    await this.e.reply(uidMsg.join('\n'))
    let msg = ''
    if (mys.hasGame('gs')) {
      msg += '原神模块支持：\n【#体力】查询当前树脂'
      msg += '\n【#签到】米游社原神自动签到'
      msg += '\n【#关闭签到】开启或关闭原神自动签到'
      msg += '\n【#原石】查看原石札记'
      msg += '\n【#原石统计】原石统计数据'
      msg += '\n【#练度统计】技能统计列表'
      msg += '\n【#uid】当前绑定ck uid列表'
      msg += '\n【#ck】检查当前用户ck是否有效'
      msg += '\n【#我的ck】查看当前绑定ck'
      msg += '\n【#删除ck】删除当前绑定ck'
    }
    if (mys.hasGame('sr')) {
      msg += '\n星穹铁道支持：\n功能还在咕咕咕~'
    }
    msg += '\n 支持绑定多个ck'
    msg = await common.makeForwardMsg(this.e, ['使用命令说明', msg], '绑定成功：使用命令说明')

    await this.e.reply(msg)
  }

  /** 删除绑定ck */
  async delCk () {
    let user = await this.user()
    // 获取当前uid
    let uidData = user.getUidData(this.e)
    if (!uidData || uidData.type !== 'ck' || !uidData.ltuid) {
      return `删除失败：当前的UID${uidData.uid}无CK信息`
    }
    await user.delMysUser(uidData.ltuid)
    return `绑定cookie已删除`
  }

  /** 绑定uid，若有ck的话优先使用ck-uid */
  async bingUid () {
    let uid = this.e.msg.match(/[1|2|5-9][0-9]{8}/g)
    if (!uid) return
    uid = uid[0]
    let user = await this.user()
    user.addRegUid(uid, this.e)
    await user.save()
    return await this.showUid()
  }

  /** #uid */
  async showUid () {
    let user = await this.user()
    let msg = []
    lodash.forEach({ gs: '原神', sr: '星穹铁道' }, (gameName, game) => {
      let uidList = user.getUidList(game)
      let currUid = user.getUid(game)
      if (uidList.length === 0) {
        return true
      }
      msg.push(`【${gameName}】`)
      lodash.forEach(uidList, (ds, idx) => {
        let tmp = `${++idx}: ${ds.uid} (${ds.type})`
        if (currUid * 1 === ds.uid * 1) {
          tmp += ' ☑'
        }
        msg.push(tmp)
      })
    })
    if (msg.length > 0) {
      msg.unshift('通过【#uid+序号】来切换uid')
      await this.e.reply(msg.join('\n'))
    } else {
      await this.e.reply('尚未绑定UID，发送CK或通过【#绑定123456789】命令来绑定UID')
    }
  }

  /** 切换uid */
  async toggleUid (index) {
    let user = await this.user()
    let game = this.e
    let uidList = user.getUidList(game)
    if (index > uidList.length) {
      return await this.e.reply('uid序号输入错误')
    }
    index = Number(index) - 1
    user.setMainUid(index, game)
    await user.save()
    return await this.showUid()
  }

  /** 加载V2ck */
  async loadOldDataV2 () {
    let file = [
      './data/MysCookie/NoteCookie.json',
      './data/NoteCookie/NoteCookie.json',
      './data/NoteCookie.json'
    ]
    let json = file.find(v => fs.existsSync(v))
    if (!json) return

    let list = JSON.parse(fs.readFileSync(json, 'utf8'))
    let arr = {}

    logger.mark(logger.green('加载用户ck...'))

    lodash.forEach(list, (ck, qq) => {
      if (ck.qq) qq = ck.qq

      let isMain = false
      if (!arr[qq]) {
        arr[qq] = {}
        isMain = true
      }

      let param = {}
      ck.cookie.split(';').forEach((v) => {
        let tmp = lodash.trim(v).split('=')
        param[tmp[0]] = tmp[1]
      })

      let ltuid = param.ltuid

      if (!param.cookie_token) return

      arr[qq][String(ck.uid)] = {
        uid: ck.uid,
        qq,
        ck: ck.cookie,
        ltuid,
        isMain
      }
    })

    let count = await this.loadOldData(arr)
    if (count > 0) {
      logger.mark(logger.green(`DB导入V2用户ck${count}个`))
    }
    fs.unlinkSync(json)
  }

  /** 加载V3ck */
  async loadOldDataV3 (data) {
    let dir = './data/MysCookie/'
    Data.createDir('./data/MysCookieBak')
    let files = fs.readdirSync(dir).filter(file => file.endsWith('.yaml'))
    const readFile = promisify(fs.readFile)
    let promises = []
    files.forEach((v) => promises.push(readFile(`${dir}${v}`, 'utf8')))
    const res = await Promise.all(promises)
    let ret = {}
    for (let v of res) {
      v = YAML.parse(v)
      let qq
      for (let k in v) {
        qq = qq || v[k]?.qq
      }
      if (qq) {
        ret[qq] = v
      }
    }
    let count = await this.loadOldData(ret)
    if (count > 0) {
      logger.mark(logger.green(`DB导入V3用户ck${count}个`))
    }
  }

  async loadOldData (data) {
    let count = 0
    if (!lodash.isPlainObject(data)) {
      return
    }
    for (let u in data) {
      let ltuids = {}
      let v = data[u]
      let qq
      for (let k in v) {
        let data = v[k]
        qq = qq || data?.qq
        let { uid, ck, ltuid, region_name: region, device_id: device } = data
        ltuids[ltuid] = ltuids[ltuid] || {
          ck,
          device,
          ltuid,
          uids: {},
          type: /America Server|Europe Server|Asia Server/.test(region) ? 'hoyolab' : 'mys'
        }
        let tmp = ltuids[ltuid]
        let game = region === '星穹列车' ? 'sr' : 'gs'
        tmp.uids[game] = tmp.uids[game] || []
        let gameUids = tmp.uids[game]
        if (!gameUids.includes(uid + '')) {
          gameUids.push(uid + '')
        }
      }
      if (!qq) {
        continue
      }
      let user = await NoteUser.create(qq)
      for (let ltuid in ltuids) {
        let data = ltuids[ltuid]
        let mys = await MysUser.create(data.ltuid)
        if (mys) {
          mys.setCkData(data)
          await mys.save()
          user.addMysUser(mys)
        }
      }
      await user.save()
      if (fs.existsSync(`./data/MysCookie/${qq}.yaml`)) {
        fs.rename(`./data/MysCookie/${qq}.yaml`, `./data/MysCookieBak/${qq}.yaml`, (err) => {
          if (err) console.log(err)
        })
      }
      count++
    }
    return count
  }

  /** 我的ck */
  async myCk () {
    let user = await this.user()
    if (!user.hasCk) {
      this.e.reply('当前尚未绑定cookie')
    }
    let mys = user.getMysUser(this.e)
    if (mys) {
      await this.e.reply(`当前绑定cookie\nuid：${mys.getUid(this.e)}`)
      await this.e.reply(mys.ck)
    }
  }

  async checkCkStatus () {
    let user = await this.user()
    if (!user.hasCk) {
      await this.e.reply(`\n未绑定CK，当前绑定uid：${user.uid || '无'}`, false, { at: true })
      return true
    }
    let uid = user.uid * 1
    let uids = user.ckUids

    let checkRet = await user.checkCk()
    let cks = []
    lodash.forEach(checkRet, (ds, idx) => {
      let tmp = [`\n#${idx + 1}: [CK:${ds.ltuid}] - 【${ds.status === 0 ? '正常' : '失效'}】`]
      if (ds.uids && ds.uids.length > 0) {
        let dsUids = []
        lodash.forEach(ds.uids, (u) => {
          dsUids.push(u * 1 === uid ? `☑${u}` : u)
        })
        tmp.push(`绑定UID: [ ${dsUids.join(', ')} ]`)
      }
      if (ds.status !== 0) {
        tmp.push(ds.msg)
      }
      cks.push(tmp.join('\n'))
    })
    if (uids.length > 1) {
      cks.push(`当前生效uid：${uid}\n通过【#uid】命令可查看并切换UID`)
    }

    await this.e.reply(cks.join('\n----\n'), false, { at: true })
  }

  async userAdmin () {
    this.model = 'userAdmin'
    await MysInfo.initCache()
    let stat = await MysUser.getStatData()
    return {
      saveId: 'user-admin',
      ...stat,
      _plugin: 'genshin',
      ...this.screenData
    }
  }
}
