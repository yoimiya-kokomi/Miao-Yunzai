import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import fetch from 'node-fetch'
import lodash from 'lodash'
import MysInfo from '../model/mys/mysInfo.js'

export class exchange extends plugin {
  constructor(e) {
    super({
      name: '兑换码',
      dsc: '前瞻直播兑换码',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^#*(直播|前瞻)*兑换码$',
          fnc: 'getCode'
        },
        {
          reg: '^#(兑换码使用|cdk-u) .+',
          fnc: 'useCode'
        }
      ]
    })
  }

  async getCode() {
    this.code_ver = ''
    this.now = parseInt(Date.now() / 1000)
    let actid = await this.getActId()
    if (!actid) return
    this.actId = actid

    /** index info */
    let index = await this.getData('index')
    if (!index || !index.data) return
    if (index.data === null) {
      return await this.reply(`错误：\n${index.message}`)
    }
    
    let index_data = index.data.live;
    let title = index_data['title'];
    this.code_ver = index_data['code_ver'];
    if (index_data.remain > 0) {
      return await this.reply(`暂无直播兑换码\n${title}`)
    }

    let code = await this.getData('code')
    if (!code || !code.data?.code_list) return
    let codes = [];

    for (let val of code.data.code_list) {
      if (val.code){
        //let title = (val.title || '').replace(/\<.*?\>/g,'')
        codes.push(val.code)
      }
    }

    let msg = ''
    if (codes.length >= 3) {
      msg = [`${title}-直播兑换码`, `兑换码存在有效期，请及时兑换哦~`, ...codes]
      msg = await common.makeForwardMsg(this.e, msg, msg[0])
    } else if (this.e.msg.includes('#')) {
      msg += codes.join('\n')
    } else {
      msg = `${title}-直播兑换码\n`
      msg += codes.join('\n')
    }

    await this.reply(msg)
  }

  async getData(type) {
    let url = {
      index: `https://api-takumi.mihoyo.com/event/miyolive/index`,
      code: `https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?version=${this.code_ver}&time=${this.now}`,
      actId: "https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=20&uid=75276550",
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

  async getActId() {
    // 获取 "act_id"
    let ret = await this.getData('actId')
    if (ret.error || ret.retcode !== 0) {
      return "";
    }

    let actId = "";
    let keywords = ["来看《原神》", "版本前瞻特别节目"];
    for (const p of ret.data.list) {
      const post = p.post.post;
      if (!post) {
        continue;
      }
      if (!keywords.every((word) => post.subject.includes(word))) {
        continue;
      }
      let shit = JSON.parse(post.structured_content);
      for (let segment of shit) {
        if (segment.insert.toString().includes('观看直播') && segment.attributes.link) {
          let matched = segment.attributes.link.match(/act_id=(.*?)&/);
          if (matched) {
            actId = matched[1];
          }
        }
      }

      if (actId) {
        break;
      }
    }

    return actId;
  }
  async useCode() {
    let cdkCode = this.e.message[0].text.split(/#(兑换码使用|cdk-u) /, 3)[2];
    let res = await MysInfo.get(this.e, 'useCdk', { cdk: cdkCode })
    if (res) {
      this.e.reply(`${res.data.msg}`)
    }
  }
}
