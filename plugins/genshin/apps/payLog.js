import plugin from '../../../lib/plugins/plugin.js'
import { PayData, renderImg } from '../model/payLogData.js'
import NoteUser from '../model/mys/NoteUser.js'
import url from 'url'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export class payLog extends plugin {
  dirPath = path.resolve('./data/payLog/')
  authKey = ''

  constructor () {
    super({
      name: '充值记录',
      dsc: '充值记录,消费记录,充值统计,消费统计',
      event: 'message',
      priority: 299,
      rule: [
        {
          reg: '^#?(充值|消费)(记录|统计)$',
          fnc: 'payLog'
        },
        {
          reg: '^#?更新(充值|消费)(记录|统计)$',
          fnc: 'updatePayLog'
        },
        {
          // 优先级高于抽卡记录，但是发送抽卡链接时不会抢指令，对比过米游社链接和抽卡链接，该字段为米游社链接字段
          reg: '(.*)(user-game-search|bill-record-user|customer-claim|player-log|user.mihoyo.com)(.*)',
          fnc: 'getAuthKey'
        },
        {
          reg: '^#?(充值|消费)(记录|统计)帮助$',
          fnc: 'payLogHelp'
        }
      ]
    })
  }

  async payLog (e) {
    // 判断是否存有已经生成的数据
    if (!fs.readdirSync(this.dirPath, 'utf-8').includes(e.user_id + '.yaml')) {
      // 如果没有则判断是否已经缓存了authkey，这个主要针对使用抽卡链接的，和苹果用户
      await this.updatePayLog()
      return true
    }

    // 如果有就判断用户的主分支uid是什么
    const mainUid = await this.isMain(e.user_id)

    // 再读取现有数据
    // const _path = path.resolve(`./data/payLog/${e.user_id}.yaml`)
    let data = fs.readFileSync(this.dirPath + `/${e.user_id}.yaml`, 'utf-8')
    data = yaml.parse(data)

    // 如果用户没有绑定ck，就直接发送保存的数据
    if (!mainUid) {
      let key = Object.keys(data)
      let img = await renderImg(data[key[0]])
      this.reply(img)
      return true
    }

    // 判断已有数据里是否有该uid的数据
    if (data[mainUid]) {
      // 如果有该uid的数据，就发送
      let img = await renderImg(data[mainUid])
      this.reply(img)
      return true
    } else {
      // 没有就获取
      this.reply('当前绑定的uid未获取数据，请私聊获取')
      return false
    }
  }

  // 获取authKey
  async getAuthKey () {
    // 判断是否为群聊发送
    if (this.e.isGroup) {
      return false
    }

    // 判断字段中是否有authkey
    if (!this.e.msg.includes('authkey')) {
      this.reply('链接无效,请重新发送')
      return false
    }

    // 解析出authKey
    let match = this.e.msg.match(/&authkey=([^&\s\u4e00-\u9fa5]+)/)
    if (!match) {
      this.reply('链接无效,请重新发送')
      return false
    }
    this.authKey = decodeURIComponent(match[1])

    // 获取数据
    this.reply('正在获取消费数据,可能需要30s~~')
    let data = new PayData(this.authKey)
    let imgData = await data.filtrateData()
    if (imgData?.errorMsg) {
      this.reply(imgData?.errorMsg)
      return true
    }

    // 发送图片
    let img = await renderImg(imgData)
    this.reply(img)

    // 存储数据
    await this.writeData(imgData)
    await redis.setEx(`Yz:genshin:mys:qq-uid:${this.e.user_id}`, 3600 * 24 * 30, imgData.uid)
    await redis.setEx(`Yz:genshin:payLog:${imgData.uid}`, 3600 * 24, this.authKey)
    return true
  }

  /** 更新充值统计 */
  async updatePayLog (e) {
    // 读一下uid
    let uid = await redis.get(`Yz:genshin:mys:qq-uid:${this.e.user_id}`)
    if (uid) {
      let mainUid = await this.isMain(this.e.user_id)
      if (mainUid) uid = mainUid
      // 读米游社链接的authkey
      // 读抽卡链接的authkey
      this.authKey = await redis.get(`Yz:genshin:payLog:${uid}`) || await redis.get(`Yz:genshin:gachaLog:url:${uid}`)
      if (this.authKey) {
        this.reply('正在获取数据,可能需要30s')
        let imgData = await new PayData(this.authKey).filtrateData()
        if (imgData?.errorMsg) {
          this.reply(imgData.errorMsg)
        } else {
          let img = await renderImg(imgData)
          this.reply(img)
          await this.writeData(imgData)
        }
        return true
      } else {
        this.reply('请私聊发送米游社链接，可以发送【#充值统计帮助】查看链接教程', false)
      }
    } else {
      this.reply('请私聊发送米游社链接，可以发送【#充值统计帮助】查看链接教程', false)
    }
    return true
  }

  payLogHelp (e) {
    e.reply('安卓教程： https://b23.tv/K5qfLad\n苹果用户可【先】发送最新获取的抽卡记录链接，【再】发送【#充值记录】或【#更新充值统计】来获取（注：通过抽卡链接获取充值记录大概率已失效）')
  }

  /** 判断主uid，若没有则返回false,有则返回主uid */
  async isMain (id, game = 'gs') {
    let user = await NoteUser.create(id)
    return user.getCkUid(game)
  }

  /** 存储数据 */
  async writeData (imgData) {
    let userPath = this.dirPath + '/' + this.e.user_id + '.yaml'
    if (fs.readdirSync(this.dirPath).includes(`${this.e.user_id}.yaml`)) {
      let data = fs.readFileSync(userPath, 'utf-8')
      data = yaml.parse(data)
      data[imgData.uid] = imgData
      fs.writeFileSync(userPath, yaml.stringify(data), 'utf-8')
    } else {
      let data = {}
      data[imgData.uid] = imgData
      fs.writeFileSync(userPath, yaml.stringify(data), 'utf-8')
    }
  }
}
