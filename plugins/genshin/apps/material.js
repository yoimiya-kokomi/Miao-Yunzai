import plugin from '../../../lib/plugins/plugin.js'
import gsCfg from '../model/gsCfg.js'
import common from '../../../lib/common/common.js'
import fs from 'node:fs'
import fetch from 'node-fetch'

export class material extends plugin {
  constructor() {
    super({
      name: "角色素材",
      dsc: "角色养成突破素材",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#?(星铁)?(.*)(突破|材料|素材|培养)$",
          fnc: "material"
        }
      ]
    })

    this.path = "./temp/material/gs/友人A"
    this.pathOther = "./temp/material/gs/other"
    this.srPath = "./temp/material/sr/小橙子啊"
    this.srPathOther = "./temp/material/sr/other"

    this.url = "https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id="

    this.collection_id = [428421, 1164644, 1362644]
    this.srCollection_id = [1998643, 2146693, 2279356]

    this.special = ["雷电将军", "珊瑚宫心海", "菲谢尔", "托马", "八重神子", "九条裟罗", "辛焱", "神里绫华"]

    this.oss = "?x-oss-process=image//resize,s_1000/quality,q_80/auto-orient,0/interlace,1/format,jpg"
  }

  /** 初始化创建配置文件 */
  async init() {
    for (let dir of ["./temp", "./temp/material", "./temp/material/gs", "./temp/material/sr", this.path, this.pathOther, this.srPath, this.srPathOther]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
      }
    }
  }

  /** #刻晴素材 *符玄素材 */
  async material() {
    let isUpdate = this.e.msg.includes("更新")
    let role = gsCfg.getRole(this.e.msg, "星铁|突破|材料|素材|更新")
    if (!role) return false

    if (["10000005", "10000007", "20000000", "8003", "8001"].includes(String(role.roleId))) {
      await this.e.reply("暂无主角素材")
      return
    }

    let pathSuffix = this.e.msg.includes("星铁") ? "sr" : ""
    this.imgPath = `${this[pathSuffix + "Path"]}/${role.name}.jpg`

    if (fs.existsSync(this.imgPath) && !isUpdate) {
      await this.e.reply(segment.image(`file://${this.imgPath}`))
      return
    }

    if (await this[`getImg${pathSuffix ? "Sr" : ""}`](role.name)) {
      return await this.e.reply(segment.image(`file://${this.imgPath}`))
    }

    this.imgPath = `${this[pathSuffix + "PathOther"]}/${role.name}.jpg`

    if (fs.existsSync(this.imgPath) && !isUpdate) {
      await this.e.reply(segment.image(`file://${this.imgPath}`))
      return
    }

    if (await this[`getImg${pathSuffix ? "OtherSr" : "Other"}`](role.name)) {
      return await this.e.reply(segment.image(`file://${this.imgPath}`))
    }

    if (await this[`getImg${pathSuffix ? "Other2Sr" : "Other2"}`](role.name)) {
      return await this.e.reply(segment.image(`file://${this.imgPath}`))
    }
  }

  /** 下载攻略图 */
  async getImg(name) {
    this.imgPath = `${this.path}/${name}.jpg`

    let ret = await this.getData(this.collection_id[0])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.image_list[1].url
        if (this.special.includes(name)) {
          url = val.image_list[2].url
        }
        break
      }
    }

    if (!url) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材图`)

    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  async getImgOther(name) {
    this.imgPath = `${this.pathOther}/${name}.jpg`

    let ret = await this.getData(this.collection_id[1])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.image_list[0].url
        break
      }
    }

    if (!url) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材图`)

    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  async getImgOther2(name) {
    this.imgPath = `${this.pathOther}/${name}.jpg`

    let ret = await this.getData(this.collection_id[2])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.image_list[2].url
        break
      }
    }

    if (!url) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材图`)

    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  async getImgSr(name) {
    this.imgPath = `${this.srPath}/${name}.jpg`

    let ret = await this.getData(this.srCollection_id[0])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.post.images[2]
        break
      }
    }

    if (!url) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材图`)

    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  async getImgOtherSr(name) {
    this.imgPath = `${this.srPathOther}/${name}.jpg`

    let ret = await this.getData(this.srCollection_id[1])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url;
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.post.images[0];
        break;
      }
    }
    if (!url) {
      return false;
    }
    logger.mark(`${this.e.logFnc} 下载${name}素材图`);
    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false;
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  async getImgOther2Sr(name) {
    this.imgPath = `${this.srPathOther}/${name}.jpg`

    let ret = await this.getData(this.srCollection_id[2])

    if (!ret || ret.retcode !== 0) {
      await this.e.reply("暂无素材数据，请稍后再试")
      logger.error(`米游社接口报错：${ret.message || "未知错误"}}`)
      return false
    }

    let url
    for (let val of ret.data.posts) {
      if (val.post.subject.includes(name)) {
        url = val.image_list[0].url
        break
      }
    }

    if (!url) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材图`)

    if (!await common.downFile(url + this.oss, this.imgPath)) {
      return false
    }

    logger.mark(`${this.e.logFnc} 下载${name}素材成功`)

    return true
  }

  /** 获取数据 */
  async getData(collectionId) {
    let response = await fetch(this.url + collectionId, { method: "get" })
    if (!response.ok) {
      return false
    }
    const res = await response.json()
    return res
  }
}