import base from './base.js'
import fetch from 'node-fetch'
import lodash from 'lodash'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import common from '../../../lib/common/common.js'
import gsCfg from '../model/gsCfg.js'

let emoticon

export default class MysSrNews extends base {
  constructor (e) {
    super(e)
    this.model = 'mysNews'
  }

  async getNews () {
    let type = 1
    let typeName = '公告'
    if (this.e.msg.includes('资讯')) {
      type = '3'
      typeName = '资讯'
    }
    if (this.e.msg.includes('活动')) {
      type = '2'
      typeName = '活动'
    }

    const res = await this.postData('getNewsList', { gids: 6, page_size: 20, type })
    if (!res) return

    const data = res.data.list
    if (data.length == 0) {
      return true
    }

    const page = this.e.msg.replace(/#|＃|星铁|星穹|铁道|公告|资讯|活动/g, '').trim() || 1
    if (page > data.length) {
      await this.e.reply('目前只查前20条最新的公告，请输入1-20之间的整数。')
      return true
    }

    const postId = data[page - 1].post.post_id

    const param = await this.newsDetail(postId)

    const img = await this.render(param)

    return await this.replyMsg(img, `崩坏星穹铁道${typeName}：${param.data.post.subject}`)
  }

  async render (param) {
    return await puppeteer.screenshots(this.model, param)
  }

  async newsDetail (postId) {
    const res = await this.postData('getPostFull', { gids: 6, read: 1, post_id: postId })
    if (!res) return

    const data = await this.detalData(res.data.post)

    return {
      ...this.screenData,
      saveId: postId,
      dataConent: data.post.content,
      data
    }
  }

  postApi (type, data) {
    let host = 'https://bbs-api-static.mihoyo.com/'
    let param = []
    lodash.forEach(data, (v, i) => param.push(`${i}=${v}`))
    param = param.join('&')
    switch (type) {
      // 搜索
      case 'searchPosts':
        host = 'https://bbs-api.mihoyo.com/post/wapi/searchPosts?'
        break
      // 帖子详情
      case 'getPostFull':
        host += 'post/wapi/getPostFull?'
        break
      // 公告列表
      case 'getNewsList':
        host += 'post/wapi/getNewsList?'
        break
      case 'emoticon':
        host += 'misc/api/emoticon_set?'
        break
    }
    return host + param
  }

  async postData (type, data) {
    const url = this.postApi(type, data)
    const headers = {
      Referer: 'https://bbs.mihoyo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
    }
    let response
    try {
      response = await fetch(url, { method: 'get', headers })
    } catch (error) {
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[米游社接口错误][${type}] ${response.status} ${response.statusText}`)
      return false
    }
    const res = await response.json()
    return res
  }

  async detalData (data) {
    let json
    try {
      json = JSON.parse(data.post.content)
    } catch (error) {

    }

    if (typeof json == 'object') {
      if (json.imgs && json.imgs.length > 0) {
        for (const val of json.imgs) {
          data.post.content = ` <div class="ql-image-box"><img src="${val}?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,png"></div>`
        }
      }
    } else {
      for (const img of data.post.images) {
        data.post.content = data.post.content.replace(img, img + '?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg')
      }

      if (!emoticon) {
        emoticon = await this.mysEmoticon()
      }

      data.post.content = data.post.content.replace(/_\([^)]*\)/g, function (t, e) {
        t = t.replace(/_\(|\)/g, '')
        if (emoticon.has(t)) {
          return `<img class="emoticon-image" src="${emoticon.get(t)}"/>`
        } else {
          return ''
        }
      })

      const arrEntities = { lt: '<', gt: '>', nbsp: ' ', amp: '&', quot: '"' }
      data.post.content = data.post.content.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) {
        return arrEntities[t]
      })
    }

    data.post.created_time = new Date(data.post.created_at * 1000).toLocaleString()

    for (const i in data.stat) {
      data.stat[i] = data.stat[i] > 10000 ? (data.stat[i] / 10000).toFixed(2) + '万' : data.stat[i]
    }

    return data
  }

  async mysEmoticon () {
    const emp = new Map()

    const res = await this.postData('emoticon', { gids: 6 })

    if (res.retcode != 0) {
      return emp
    }

    for (const val of res.data.list) {
      if (!val.icon) continue
      for (const list of val.list) {
        if (!list.icon) continue
        emp.set(list.name, list.icon)
      }
    }

    return emp
  }

  async replyMsg (img, titile) {
    if (!img || img.length <= 0) return false
    if (img.length == 1) {
      return img[0]
    } else {
      let msg = [titile, ...img]
      return await common.makeForwardMsg(this.e, msg, titile).catch((err) => {
        logger.error(err)
      })
    }
  }

  async mysNewsTask (type = 1) {
    let cfg = gsCfg.getConfig('mys', 'pushNews')

    // 推送2小时内的公告资讯
    let interval = 7200
    // 最多同时推送两条
    this.maxNum = cfg.maxNum
    // 包含关键字不推送
    let banWord = /冒险助力礼包|纪行|预下载|脚本外挂|集中反馈|已开奖|云·原神|魔神任务|传说任务说明/g

    let anno = await this.postData('getNewsList', { gids: 6, page_size: 10, type: 1 })
    let info = await this.postData('getNewsList', { gids: 6, page_size: 10, type: 3 })

    let news = []
    if (anno) anno.data.list.forEach(v => { news.push({ ...v, typeName: '公告', post_id: v.post.post_id }) })
    if (info) info.data.list.forEach(v => { news.push({ ...v, typeName: '资讯', post_id: v.post.post_id }) })
    if (news.length <= 0) return

    news = lodash.orderBy(news, ['post_id'], ['asc'])

    let now = Date.now() / 1000

    this.key = 'Yz:genshin:mys:newPush:'
    this.e.isGroup = true
    this.pushGroup = []
    for (let val of news) {
      if (Number(now - val.post.created_at) > interval) {
        continue
      }
      if (new RegExp(banWord).test(val.post.subject)) {
        continue
      }
      if (val.typeName == '公告') {
        for (let groupId of cfg.srannounceGroup) {
          await this.sendNews(groupId, val.typeName, val.post.post_id)
        }
      }
      if (val.typeName == '资讯') {
        for (let groupId of cfg.srinfoGroup) {
          await this.sendNews(groupId, val.typeName, val.post.post_id)
        }
      }
    }
  }

  async sendNews (groupId, typeName, postId) {
    if (!this.pushGroup[groupId]) this.pushGroup[groupId] = 0
    if (this.pushGroup[groupId] >= this.maxNum) return

    let sended = await redis.get(`${this.key}${groupId}:${postId}`)
    if (sended) return

    // TODO: 暂时处理，后续待更好的解决方案 （定时任务无法获取e.bot）
    this.e.bot = Bot

    // 判断是否存在群关系
    if (!this.e.bot.gl.get(Number(groupId))) {
      logger.mark(`[崩坏星穹铁道${typeName}推送] 群${groupId}未关联`)
      return
    }

    if (!this[postId]) {
      const param = await this.newsDetail(postId)

      logger.mark(`[崩坏星穹铁道${typeName}推送] ${param.data.post.subject}`)

      this[postId] = {
        img: await this.render(param),
        title: param.data.post.subject
      }
    }

    this.pushGroup[groupId]++
    this.e.group = Bot.pickGroup(Number(groupId))
    this.e.group_id = Number(groupId)
    let tmp = await this.replyMsg(this[postId].img, `崩坏星穹铁道${typeName}推送：${this[postId].title}`)

    await common.sleep(1000)
    if (!tmp) return

    if (tmp?.type != 'xml') {
      tmp = [`崩坏星穹铁道${typeName}推送\n`, tmp]
    }

    redis.set(`${this.key}${groupId}:${postId}`, '1', { EX: 3600 * 10 })
    // 随机延迟10-90秒
    await common.sleep(lodash.random(10, 90) * 1000)
    await this.e.group.sendMsg(tmp)
  }
}
