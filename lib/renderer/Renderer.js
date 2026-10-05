import template from "art-template"
import chokidar from "chokidar"
import path from "node:path"
import fs from "node:fs"

export default class Renderer {
  /**
   * 渲染器
   * @param data.id 渲染器ID
   * @param data.type 渲染器类型
   * @param data.render 渲染器入口
   */
  constructor(data) {
    /** 渲染器ID */
    this.id = data.id || "renderer"
    /** 渲染器类型 */
    this.type = data.type || "image"
    /** 渲染器入口 */
    this.render = this[data.render || "render"]
    /** 支持 <script> */
    this.support_script = data.support_script ?? true
    this.dealTpl = Renderer.dealTpl.bind(Renderer)
  }

  static dir = "./temp/html"
  static html = {}
  static watcher = {}
  static tplQueue = new Map()

  /** 获取生成的 HTML 路径 */
  static getTplPath(name, data) {
    return `./temp/html/${name}/${data.saveId ?? name}.html`
  }

  /**
   * 按生成的 HTML 路径串行渲染，避免并发请求覆盖正在读取的模板
   * @param {string} name 模板名称
   * @param {object} data 模板参数
   * @param {Function} render 本次渲染操作
   * @returns {Promise<*>} 渲染结果
   */
  static async withTpl(name, data, render) {
    const key = path.resolve(this.getTplPath(name, data))
    const previous = this.tplQueue.get(key) || Promise.resolve()
    let release
    const current = new Promise(resolve => (release = resolve))
    this.tplQueue.set(key, current)
    await previous
    try {
      return await render()
    } finally {
      release()
      if (this.tplQueue.get(key) === current) this.tplQueue.delete(key)
    }
  }

  /** 创建文件夹 */
  static createDir(dirname) {
    if (fs.existsSync(dirname)) {
      return true
    } else {
      if (this.createDir(path.dirname(dirname))) {
        fs.mkdirSync(dirname)
        return true
      }
    }
  }

  /** 读取html模板 */
  static readTpl(tplFile) {
    if (!this.html[tplFile]) {
      try {
        this.html[tplFile] = fs.readFileSync(tplFile, "utf8")
      } catch (error) {
        logger.error(`加载html错误：${tplFile}`)
        return false
      }
      this.watch(tplFile)
    }
    return this.html[tplFile]
  }

  /** 模板 */
  static dealTpl(name, data) {
    const html = this.readTpl(data.tplFile)
    if (!html) return false

    /** 替换模板 */
    data.resPath = `./resources/`
    const tmpHtml = template.render(html, data)
    /** 保存模板 */
    this.createDir(`./temp/html/${name}`)
    const savePath = this.getTplPath(name, data)
    fs.writeFileSync(savePath, tmpHtml)

    logger.debug(`[图片生成][使用模板] ${savePath}`)
    return savePath
  }

  /** 监听配置文件 */
  static watch(tplFile) {
    if (this.watcher[tplFile]) return

    const watcher = chokidar.watch(tplFile)
    watcher.on("change", () => {
      delete this.html[tplFile]
      logger.mark(`[修改html模板] ${tplFile}`)
    })

    this.watcher[tplFile] = watcher
  }
}
