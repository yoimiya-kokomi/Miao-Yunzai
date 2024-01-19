import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import fetch from 'node-fetch'
import MysInfo from '../model/mys/mysInfo.js'

export class exchange extends plugin {
  constructor() {
    super({
      name: '兑换码',
      dsc: '前瞻直播兑换码',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: /^(#|\*)?(原神|星铁|崩铁|崩三|崩坏三|崩坏3)?(直播|前瞻)?兑换码$/,
          fnc: 'getCode'
        },
        {
          reg: '^#(兑换码使用|cdk-u).+',
          fnc: 'useCode'
        }
      ]
    })
  }

  async getCode() {
    let reg = this.e.msg.match(/^(#|\*)?(原神|星铁|崩铁|崩三|崩坏三|崩坏3)?(直播|前瞻)?兑换码$/)
    this.uid = '75276550'
    if (reg[1] == '*' || ["星铁", "崩铁"].includes(reg[2])) {
      this.uid = '80823548'
    }
    if (reg[3] == ["崩三", "崩坏三", "崩坏3"].includes(reg[4])) {
      this.uid = '73565430'
    }
    this.now = parseInt(Date.now() / 1000)
    let actid = await this.getActId()
    if (!actid) {
      logger.info('[兑换码] 未获取到actId')
      return true
    }
    this.actId = actid

    /** index info */
    let index = await this.getData('index')
    if (!index || !index.data) { return true }
    if (index.data === null) {
      return await this.reply(`错误：\n${index.message}`)
    }

    let index_data = index.data.live;
    let title = index_data['title'];
    this.code_ver = index_data['code_ver'];
    if (index_data.remain > 0) {
      return await this.reply(`暂无${title}直播兑换码`, true)
    }

    let code = await this.getData('code')
    if (!code || !code.data?.code_list) {
      logger.info('[兑换码] 未获取到兑换码')
      return true
    }
    let codes = [];

    for (let val of code.data.code_list) {
      if (val.code) {
        codes.push([val.code, segment.button([
          { text: "兑换", callback: `#兑换码使用${val.code}` },
        ])])
      }
    }

    let msg = [`兑换码过期时间: \n${this.deadline}`, ...codes]
    msg = await common.makeForwardMsg(this.e, msg, `${title}-直播兑换码`)
    await this.reply(msg)
  }

  async getData(type) {
    let url = {
      index: `https://api-takumi.mihoyo.com/event/miyolive/index`,
      code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`,
      actId: `https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=20&uid=${this.uid}`,
    }

    let response
    try {
      response = await fetch(url[type], {
        method: 'get',
        headers: {
          'x-rpc-act_id': this.actId
        }
      })
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[兑换码接口错误][${type}] ${response.status} ${response.statusText}`)
      return false
    }
    const res = await response.json()
    return res
  }

  // 获取 "act_id"
  async getActId() {
    let ret = await this.getData('actId')
    if (ret.error || ret.retcode !== 0) {
      return "";
    }

    for (const p of ret.data.list) {
      const post = p.post.post;
      if (!post) {
        continue;
      }
      let date = new Date(post.created_at * 1000)
      date.setDate(date.getDate() + 1)
      this.deadline = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} 12:00:00`
      let structured_content = post.structured_content
      let result = structured_content.match(/{\"link\":\"https:\/\/webstatic.mihoyo.com\/bbs\/event\/live\/index.html\?act_id=(.*?)\\/)
      if (result) {
        return result[1]
      }
    }
  }
  // 兑换码使用
  async useCode() {
    const cdkCode = this.e.msg.replace(/#(兑换码使用|cdk-u)/, "").trim()
    const res = await MysInfo.get(this.e, 'useCdk', { cdk: cdkCode })
    if (res) {
      this.e.reply(`${res.data.msg}`)
    }
  }
}