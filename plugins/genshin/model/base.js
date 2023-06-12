
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
    let headImg = '枫原万叶'

    return {
      saveId: this.userId,
      cwd: this._path,
      tplFile: `./plugins/genshin/resources/html/${this.model}/${this.model}.html`,
      /** 绝对路径 */
      pluResPath: `${this._path}/plugins/genshin/resources/`,
      headStyle: `<style> .head_box { background: url(${this._path}/plugins/genshin/resources/img/namecard/${headImg}.png) #fff; background-position-x: 42px; background-repeat: no-repeat; background-size: auto 101%; }</style>`
    }
  }
}
