import fs from 'node:fs'
import _ from 'lodash'

export default class base {
  constructor(e = {}) {
    this.e = e
    this.userId = e?.user_id
    this.model = 'genshin'
    this._path = process.cwd().replace(/\\/g, '/')
  }

  get prefix() {
    return `Yz:genshin:${this.model}:`
  }

  /**
   * 截图默认数据
   * @param saveId html保存id
   * @param tplFile 模板html路径
   * @param pluResPath 插件资源路径
   */
  get screenData() {
    let miaoPath = 'plugins/miao-plugin/resources'
    if (this.e?.isSr) {
      let headImg = _.sample(fs.readdirSync(`${this._path}/plugins/genshin/resources/StarRail/img/worldcard`).filter(file => file.endsWith('.png')))
      return {
        saveId: this.userId,
        cwd: this._path,
        tplFile: `./plugins/genshin/resources/StarRail/html/${this.model}/${this.model}.html`,
        /** 绝对路径 */
        pluResPath: `${this._path}/plugins/genshin/resources/StarRail/`,
        miaoResPath: `${this._path}/${miaoPath}/meta-sr/`,
        headStyle: `<style> .head_box { background: url(${this._path}/plugins/genshin/resources/StarRail/img/worldcard/${headImg}) #fff; background-position-x: -10px; background-repeat: no-repeat; background-size: 540px; background-position-y: -100px; </style>`,
        srtempFile: 'StarRail/'
      }
    }

    let headImg = _.sample(fs.readdirSync(`${this._path}/${miaoPath}/${meta}/character`, { withFileTypes: true }).filter(file => file.isDirectory() && file.name !== 'common').map(role => role.name))
    return {
      saveId: this.userId,
      cwd: this._path,
      tplFile: `./plugins/genshin/resources/html/${this.model}/${this.model}.html`,
      /** 绝对路径 */
      pluResPath: `${this._path}/plugins/genshin/resources/`,
      miaoResPath: `${this._path}/${miaoPath}/meta/`,
      headStyle: `<style> .head_box { background: url(${this._path}/${miaoPath}/meta/character/${headImg}/imgs/banner.webp) #fff; background-position-x: 42px; background-repeat: no-repeat; background-size: auto 101%; }</style>`,
      srtempFile: ''
    }
  }
}
