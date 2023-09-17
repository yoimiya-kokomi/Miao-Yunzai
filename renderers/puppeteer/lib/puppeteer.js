import Renderer from '../../../lib/renderer/Renderer.js'
import os from 'node:os'
import lodash from 'lodash'
import puppeteer from 'puppeteer'
// 暂时保留对原config的兼容
import cfg from '../../../lib/config/config.js'
import { Data } from '#miao'
import path from 'path'

// mac地址
let mac = ''

export default class Puppeteer extends Renderer {
  constructor(config) {
    super({
      id: 'puppeteer',
      type: 'image',
      render: 'screenshot'
    })
    this.browser = false
    this.lock = false
    this.shoting = []
    /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
    this.restartNum = 100
    /** 截图次数 */
    this.renderNum = 0
    this.config = {
      headless: Data.def(config.headless, 'new'),
      args: Data.def(config.args, [
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote'
      ])
    }
    if (config.chromiumPath || cfg?.bot?.chromium_path) {
      /** chromium其他路径 */
      this.config.executablePath = config.chromiumPath || cfg?.bot?.chromium_path
    }
    if (config.puppeteerWS || cfg?.bot?.puppeteer_ws) {
      /** chromium其他路径 */
      this.config.wsEndpoint = config.puppeteerWS || cfg?.bot?.puppeteer_ws
    }
  }

  /**
   * 初始化chromium
   */
  async browserInit() {
    if (this.browser) return this.browser
    if (this.lock) return false
    this.lock = true

    logger.info('puppeteer Chromium 启动中...')

    let connectFlag = false
    try {
      // 获取Mac地址
      if (!mac) {
        mac = await this.getMac()
        this.browserMacKey = `Yz:chromium:browserWSEndpoint:${mac}`
      }
      // 是否有browser实例
      const browserUrl = (await redis.get(this.browserMacKey)) || this.config.wsEndpoint
      if (browserUrl) {
        logger.info(`puppeteer Chromium from ${browserUrl}`)
        const browserWSEndpoint = await puppeteer.connect({ browserWSEndpoint: browserUrl }).catch((err) => {
          logger.error('puppeteer Chromium 缓存的实例已关闭')
          redis.del(this.browserMacKey)
        })
        // 如果有实例，直接使用
        if (browserWSEndpoint) {
          this.browser = browserWSEndpoint
          if (this.browser) {
            connectFlag = true
          }
        }
      }
    } catch (e) {
      logger.info('puppeteer Chromium 不存在已有实例')
    }

    if (!this.browser || !connectFlag) {
      // 如果没有实例，初始化puppeteer
      this.browser = await puppeteer.launch(this.config).catch((err, trace) => {
        let errMsg = err.toString() + (trace ? trace.toString() : '')
        if (typeof err == 'object') {
          logger.error(JSON.stringify(err))
        } else {
          logger.error(err.toString())
          if (errMsg.includes('Could not find Chromium')) {
            logger.error('没有正确安装 Chromium，可以尝试执行安装命令：node node_modules/puppeteer/install.js')
          } else if (errMsg.includes('cannot open shared object file')) {
            logger.error('没有正确安装 Chromium 运行库')
          }
        }
        logger.error(err, trace)
      })
    }

    this.lock = false

    if (!this.browser) {
      logger.error('puppeteer Chromium 启动失败')
      return false
    }
    if (connectFlag) {
      logger.info('puppeteer Chromium 已连接启动的实例')
    } else {
      logger.info(`[Chromium] ${this.browser.wsEndpoint()}`)
      if (process.env.pm_id && this.browserMacKey) {
        // 缓存一下实例30天
        const expireTime = 60 * 60 * 24 * 30
        await redis.set(this.browserMacKey, this.browser.wsEndpoint(), { EX: expireTime })
      }
      logger.info('puppeteer Chromium 启动成功')
    }

    /** 监听Chromium实例是否断开 */
    this.browser.on('disconnected', (e) => {
      logger.error('Chromium 实例关闭或崩溃！')
      this.browser = false
    })

    return this.browser
  }

  // 获取Mac地址
  getMac () {
    const mac = '00:00:00:00:00:00'
    try {
      const network = os.networkInterfaces()
      for (const a in network) {
        for (const i of network[a]) {
          if (i.mac && i.mac != mac) {
            return i.mac
          }
        }
      }
    } catch (e) {
    }
    return mac
  }

  /**
   * `chromium` 截图
   * @param data 模板参数
   * @param data.tplFile 模板路径，必传
   * @param data.saveId  生成html名称，为空name代替
   * @param data.imgType  screenshot参数，生成图片类型：jpeg，png
   * @param data.quality  screenshot参数，图片质量 0-100，jpeg是可传，默认90
   * @param data.omitBackground  screenshot参数，隐藏默认的白色背景，背景透明。默认不透明
   * @param data.path   screenshot参数，截图保存路径。截图图片类型将从文件扩展名推断出来。如果是相对路径，则从当前路径解析。如果没有指定路径，图片将不会保存到硬盘。
   * @param data.multiPage 是否分页截图，默认false
   * @param data.multiPageHeight 分页状态下页面高度，默认4000
   * @param data.pageGotoParams 页面goto时的参数
   * @return img/[]img 不做segment包裹
   */
  async screenshot(name, data = {}) {
    if (!await this.browserInit()) {
      return false
    }
    const pageHeight = data.multiPageHeight || 4000

    let savePath = this.dealTpl(name, data)
    if (!savePath) {
      return false
    }

    let buff = ''
    let start = Date.now()

    let ret = []
    this.shoting.push(name)

    try {
      const page = await this.browser.newPage()
      let pageGotoParams = lodash.extend({ timeout: 120000 }, data.pageGotoParams || {})
      await page.goto('file://' + path.resolve(savePath), pageGotoParams)
      let body = await page.$('#container') || await page.$('body')

      // 计算页面高度
      const boundingBox = await body.boundingBox()
      // 分页数
      let num = 1

      let randData = {
        type: data.imgType || 'jpeg',
        omitBackground: data.omitBackground || false,
        quality: data.quality || 90,
        path: data.path || ''
      }

      if (data.multiPage) {
        randData.type = 'jpeg'
        num = Math.round(boundingBox.height / pageHeight) || 1
      }

      if (data.imgType === 'png') {
        delete randData.quality
      }

      if (!data.multiPage) {
        buff = await body.screenshot(randData)
        /** 计算图片大小 */
        const kb = (buff.length / 1024).toFixed(2) + 'KB'
        logger.mark(`[图片生成][${name}][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)
        this.renderNum++
        ret.push(buff)
      } else {
        // 分片截图
        if (num > 1) {
          await page.setViewport({
            width: boundingBox.width,
            height: pageHeight + 100
          })
        }
        for (let i = 1; i <= num; i++) {
          if (i !== 1 && i === num) {
            await page.setViewport({
              width: boundingBox.width,
              height: parseInt(boundingBox.height) - pageHeight * (num - 1)
            })
          }
          if (i !== 1 && i <= num) {
            await page.evaluate(pageHeight => window.scrollBy(0, pageHeight), pageHeight)
          }
          if (num === 1) {
            buff = await body.screenshot(randData)
          } else {
            buff = await page.screenshot(randData)
          }
          if (num > 2) {
            await Data.sleep(200)
          }
          this.renderNum++

          /** 计算图片大小 */
          const kb = (buff.length / 1024).toFixed(2) + 'KB'
          logger.mark(`[图片生成][${name}][${i}/${num}] ${kb}`)
          ret.push(buff)
        }
        if (num > 1) {
          logger.mark(`[图片生成][${name}] 处理完成`)
        }
      }
      page.close().catch((err) => logger.error(err))
    } catch (error) {
      logger.error(`[图片生成][${name}] 图片生成失败：${error}`)
      /** 关闭浏览器 */
      if (this.browser) {
        await this.browser.close().catch((err) => logger.error(err))
      }
      this.browser = false
      ret = []
      return false
    }

    this.shoting.pop()

    if (ret.length === 0 || !ret[0]) {
      logger.error(`[图片生成][${name}] 图片生成为空`)
      return false
    }

    this.restart()

    return data.multiPage ? ret : ret[0]
  }

  /** 重启 */
  restart() {
    /** 截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢 */
    if (this.renderNum % this.restartNum === 0) {
      if (this.shoting.length <= 0) {
        setTimeout(async () => {
          if (this.browser) {
            await this.browser.close().catch((err) => logger.error(err))
          }
          this.browser = false
          logger.info('puppeteer Chromium 关闭重启...')
        }, 100)
      }
    }
  }
}
