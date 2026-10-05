import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import Renderer from "../../../lib/renderer/Renderer.js"
import shotium from "@shotkit/shotium"
import imageSize from "image-size"

const _path = process.cwd()

/**
 * 模板里没有 #container 时退回到 body，与 puppeteer 渲染器的 `page.$("#container") || page.$("body")` 一致
 */
const SELECTORS = ["#container", "body"]

export default class Shotium extends Renderer {
  constructor(config = {}) {
    super({
      id: "shotium",
      type: "image",
      render: "screenshot",
      support_script: false,
    })
    this.config = {
      mode: config.mode === "daemon" ? "daemon" : "inprocess",
      viewport: {
        width: Number(config.viewport?.width) || 800,
        height: Number(config.viewport?.height) || 600,
      },
      scale: Number(config.scale) || 1,
      waitUntil: ["load", "networkidle", "auto"].includes(config.waitUntil)
        ? config.waitUntil
        : "load",
      timeout: Number(config.timeout) || 30000,
      imgType: ["jpeg", "png", "webp"].includes(config.imgType) ? config.imgType : "jpeg",
      quality: Number(config.quality) || 90,
      multiPageHeight: Number(config.multiPageHeight) || 4000,
      releaseMemoryEvery: Number(config.releaseMemoryEvery ?? 100) || 0,
      cacheDir: String(config.cacheDir ?? "temp/shotium").trim(),
      cacheMaxBytes: Number(config.cacheMaxBytes) || 256 * 1024 * 1024,
      userAgent: String(config.userAgent ?? "").trim(),
      idleTimeoutMs: Number(config.idleTimeoutMs ?? 300000),
      logStats: !!config.logStats,
    }
    /** 截图次数 */
    this.renderNum = 0
    /** 当前等待队列 */
    this.shoting = []
    /** daemon 模式下的连接 */
    this.client = null
    this.connecting = null
    /** 引擎是否已经启动（inprocess） */
    this.started = false
  }

  /** 引擎启动参数 */
  get startOptions() {
    const options = { cacheMaxBytes: this.config.cacheMaxBytes }
    /** 留空是「用引擎默认目录」，off 才是「关掉」 */
    if (this.config.cacheDir === "off") options.cacheDir = null
    else if (this.config.cacheDir) options.cacheDir = this.config.cacheDir
    if (this.config.userAgent) options.userAgent = this.config.userAgent
    return options
  }

  /**
   * 进程内引擎：第一次截图时启动，之后一直常驻
   */
  startInprocess() {
    if (this.started) return true
    const result = shotium.start(this.startOptions)
    this.started = true
    logger.info(
      `shotium 引擎已启动 (进程内) cache=${result.cacheActive ? result.cacheDir : "已关闭"}`,
    )
    return true
  }

  /**
   * daemon 引擎：连上已有的守护进程，没有就拉起一个；断开后下次截图时重连
   */
  async connectDaemon() {
    if (this.client) return this.client
    if (!this.connecting) {
      this.connecting = shotium.daemon
        .connect({ ...this.startOptions, idleTimeoutMs: this.config.idleTimeoutMs })
        .then(client => {
          this.client = client
          client.once("close", () => {
            this.client = null
            logger.warn("shotium 守护进程连接已断开，下次截图时重连")
          })
          logger.info("shotium 引擎已连接 (守护进程)")
          return client
        })
        .finally(() => {
          this.connecting = null
        })
    }
    return this.connecting
  }

  /**
   * 交给引擎截一张
   * @param options shotium 的 ScreenshotOptions
   */
  async shot(options) {
    if (this.config.mode === "daemon") {
      const client = await this.connectDaemon()
      try {
        return await client.screenshot(options)
      } catch (err) {
        /** 连接还在，说明是渲染本身的错误（选择器没匹配、超时等），原样抛出 */
        if (!client.closed) throw err
        /** 连接断了才重连一次再试 */
        this.client = null
        return await (await this.connectDaemon()).screenshot(options)
      }
    }
    this.startInprocess()
    return shotium.screenshot(options)
  }

  /**
   * 截容器：优先 #container，没有再退回 body
   * @param options 不含 selector 的 ScreenshotOptions
   */
  async shotContainer(options) {
    let lastErr
    for (const selector of SELECTORS) {
      try {
        return await this.shot({ ...options, selector })
      } catch (err) {
        lastErr = err
        if (!/no element matches the selector/.test(String(err?.message || err))) throw err
      }
    }
    throw lastErr
  }

  /**
   * 把调用方的 pageGotoParams 归一成引擎的参数
   * @param params 调用方传入的 pageGotoParams
   */
  gotoParams(params = {}) {
    let waitUntil = this.config.waitUntil
    if (waitUntil === "auto") {
      const list = [].concat(params.waitUntil || [])
      waitUntil = list.some(v => String(v).startsWith("networkidle")) ? "networkidle" : "load"
    }
    const timeout = Number(params.timeout) > 0 ? Number(params.timeout) : this.config.timeout
    return { waitUntil, timeout }
  }

  /**
   * `shotium` 截图
   * @param name 模板名（plugin/path）
   * @param data 模板参数
   * @param data.tplFile 模板路径，必传
   * @param data.saveId  生成 html 名称，为空 name 代替
   * @param data.imgType  生成图片类型：jpeg，png，webp
   * @param data.quality  图片质量 0-100，jpeg / webp 可传，默认 90
   * @param data.omitBackground  隐藏默认的白色背景，背景透明。jpeg 无 alpha 通道会忽略
   * @param data.path   截图保存路径。如果是相对路径，则从当前路径解析。不指定时不落盘
   * @param data.multiPage 是否分页截图，默认 false
   * @param data.multiPageHeight 分页状态下单张高度（css 像素），默认取配置
   * @param data.pageGotoParams 页面加载参数，waitUntil 只在配置为 auto 时生效
   * @return img 不做 segment 包裹；multiPage 时返回数组；失败返回 false
   */
  async screenshot(name, data = {}) {
    return Renderer.withTpl(name, data, () => this.captureScreenshot(name, data))
  }

  /** 执行已取得模板路径锁的截图 */
  async captureScreenshot(name, data) {
    const savePath = this.dealTpl(name, data)
    if (!savePath) return false

    const start = Date.now()
    const pageHeight = Number(data.multiPageHeight) || this.config.multiPageHeight
    const type = data.multiPage ? "jpeg" : data.imgType || this.config.imgType

    const options = {
      file: pathToFileURL(path.resolve(_path, savePath)).href,
      type,
      viewport: { ...this.config.viewport },
      scale: this.config.scale,
      pageGotoParams: this.gotoParams(data.pageGotoParams),
      /** 模板通过相对路径引用各插件 resources 目录下的图片和字体，file:// 文档必须放开子资源读取 */
      allowFileAccess: true,
    }
    if (type !== "png") options.quality = Number(data.quality) || this.config.quality
    if (data.omitBackground && type !== "jpeg") options.omitBackground = true

    this.shoting.push(name)
    let ret = []
    try {
      if (!data.multiPage) {
        const result = await this.shotContainer(options)
        ret.push(result.image)
        this.renderNum++
        logger.mark(
          `[图片生成][${name}][${this.renderNum}次] ${this.kb(result.image)} ${logger.green(`${Date.now() - start}ms`)}${this.stats(result)}`,
        )
      } else {
        ret = await this.screenshotPages(name, options, pageHeight)
      }
    } catch (err) {
      logger.error(`[图片生成][${name}] 图片生成失败`, err)
      return false
    } finally {
      this.shoting.pop()
    }

    if (ret.length === 0 || !ret[0]) {
      logger.error(`[图片生成][${name}] 图片生成为空`)
      return false
    }

    if (data.path) {
      try {
        const file = path.resolve(_path, data.path)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, ret[0])
      } catch (err) {
        logger.error(`[图片生成][${name}] 图片保存失败 ${data.path}`, err)
      }
    }

    this.releaseMemory()
    return data.multiPage ? ret : ret[0]
  }

  /**
   * 分片截图
   *
   * puppeteer 那边是「改视窗高度、滚动、重截几次」；这里先把容器整张截下来量高度，
   * 超过一页时再用 clip 按文档坐标逐片截取，每片都是同一次布局的结果，不会出现分片之间对不上的情况。
   *
   * @param name 模板名
   * @param options 引擎参数
   * @param pageHeight 单张高度（css 像素）
   */
  async screenshotPages(name, options, pageHeight) {
    const first = await this.shotContainer(options)
    const size = imageSize(first.image)
    const scale = options.scale || 1
    const height = size ? size.height / scale : 0
    const width = size ? size.width / scale : 0
    const num = Math.round(height / pageHeight) || 1

    if (num === 1 || !size) {
      this.renderNum++
      logger.mark(`[图片生成][${name}][1/1] ${this.kb(first.image)}${this.stats(first)}`)
      return [first.image]
    }

    const ret = []
    for (let i = 0; i < num; i++) {
      const y = i * pageHeight
      const h = i === num - 1 ? Math.ceil(height - y) : pageHeight
      const result = await this.shot({
        ...options,
        clip: { x: 0, y, width: Math.ceil(width), height: h },
      })
      this.renderNum++
      logger.mark(
        `[图片生成][${name}][${i + 1}/${num}] ${this.kb(result.image)}${this.stats(result)}`,
      )
      ret.push(result.image)
    }
    logger.mark(`[图片生成][${name}] 处理完成`)
    return ret
  }

  /** 每 releaseMemoryEvery 张把引擎能重建的内存还给系统，对应 puppeteer 的定期重启 */
  releaseMemory() {
    const every = this.config.releaseMemoryEvery
    if (!every || this.renderNum % every !== 0 || this.shoting.length > 0) return
    if (this.config.mode === "daemon") {
      this.client?.releaseMemory({ releaseWorkingSet: false }).catch(() => {})
    } else if (this.started) {
      shotium.releaseMemory({ releaseWorkingSet: false })
    }
  }

  /** 计算图片大小 */
  kb(buf) {
    return `${(buf.length / 1024).toFixed(2)}KB`
  }

  /** 引擎侧统计 */
  stats(result) {
    if (!this.config.logStats || !result?.stats) return ""
    const s = result.stats
    return ` 请求:${s.requests}(缓存${s.fromCache}/失败${s.failed}) 引擎:${s.timing.total.toFixed(1)}ms`
  }

  /** 关闭引擎 */
  async stop() {
    if (this.config.mode === "daemon") {
      this.client?.close()
      this.client = null
      return
    }
    if (this.started) {
      this.started = false
      await shotium.stop()
    }
  }
}
