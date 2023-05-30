import fs from 'node:fs'
import os from 'node:os'
import lodash from 'lodash'
import template from 'art-template'
import chokidar from 'chokidar'
import puppeteer from 'puppeteer'
// 暂时保留对原config的兼容
import cfg from '../../../lib/config/config.js'
import { Data } from '#miao'

const _path = process.cwd()

// mac地址
let mac = ''

export default class PuppeteerRenderer {
  constructor (config) {
    this.browser = false
    this.lock = false
    this.shoting = []
    /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
    this.restartNum = 100
    /** 截图次数 */
    this.renderNum = 0
    this.config = {
      headless: Data.def(config.headless, "new"),
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

    this.html = {}
    this.watcher = {}
    this.createDir('./temp/html')
  }

  createDir (dir) {
    if (!fs.existsSync(dir)) {
      let dirs = dir.split('/')
      for (let idx = 1; idx <= dirs.length; idx++) {
        let temp = dirs.slice(0, idx).join('/')
        if (!fs.existsSync(temp)) {
          fs.mkdirSync(temp)
        }
      }
    }
  }

  /**
   * 初始化chromium
   */
  async browserInit () {
    if (this.browser) return this.browser
    if (this.lock) return false
    this.lock = true

    logger.mark('puppeteer Chromium 启动中...')

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
        logger.mark(`puppeteer Chromium from ${browserUrl}`)
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
      logger.mark('puppeteer Chromium 不存在已有实例')
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
            logger.error('没有正确安装Chromium，可以尝试执行安装命令：node ./node_modules/puppeteer/install.js')
          } else if (errMsg.includes('libatk-bridge')) {
            logger.error('没有正确安装Chromium，可尝试执行 sudo yum install -y chromium')
          }
        }
        console.log(err, trace)
      })
    }

    this.lock = false

    if (!this.browser) {
      logger.error('puppeteer Chromium 启动失败')
      return false
    }
    if (connectFlag) {
      logger.mark('puppeteer Chromium 已连接启动的实例')
    } else {
      console.log('chromium', this.browser.wsEndpoint())
      if (process.env.pm_id && this.browserMacKey) {
        //缓存一下实例30天
        const expireTime = 60 * 60 * 24 * 30
        await redis.set(this.browserMacKey, this.browser.wsEndpoint(), { EX: expireTime })
      }
      logger.mark('puppeteer Chromium 启动成功')
    }

    /** 监听Chromium实例是否断开 */
    this.browser.on('disconnected', (e) => {
      logger.error('Chromium实例关闭或崩溃！')
      this.browser = false
    })

    return this.browser
  }

  // 获取Mac地址
  async getMac () {
    // 获取Mac地址
    let mac = '00:00:00:00:00:00'
    try {
      const network = os.networkInterfaces()
      let osMac
      // 判断系统
      if (os.platform() === 'win32') {
        // windows下获取mac地址
        let osMacList = Object.keys(network).map(key => network[key]).flat()
        osMacList = osMacList.filter(item => item.family === 'IPv4' && item.mac !== mac)
        osMac = osMacList[0].mac
      } else if (os.platform() === 'linux') {
        // linux下获取mac地址
        osMac = network.eth0.filter(item => item.family === 'IPv4' && item.mac !== mac)[0].mac
      }
      if (osMac) {
        mac = String(osMac)
      }
    } catch (e) {
      console.log('获取Mac地址失败', e.toString())
    }
    mac = mac.replace(/:/g, '')
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
  async screenshot (name, data = {}) {
    if (!await this.browserInit()) {
      return false
    }
    const pageHeight = data.multiPageHeight || 4000

    let savePath = this.dealTpl(name, data)
    if (!savePath) return false

    let buff = ''
    let start = Date.now()

    let ret = []
    this.shoting.push(name)

    try {
      const page = await this.browser.newPage()
      let pageGotoParams = lodash.extend({ timeout: 120000 }, data.pageGotoParams || {})
      await page.goto(`file://${_path}${lodash.trim(savePath, '.')}`, pageGotoParams)
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
        const kb = (buff.length / 1024).toFixed(2) + 'kb'
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
          if (num > 2) await Data.sleep(200)
          this.renderNum++

          /** 计算图片大小 */
          const kb = (buff.length / 1024).toFixed(2) + 'kb'
          logger.mark(`[图片生成][${name}][${i}/${num}] ${kb}`)
          ret.push(buff)
        }
        if (num > 1) {
          logger.mark(`[图片生成][${name}] 处理完成`)
        }
      }
      page.close().catch((err) => logger.error(err))

    } catch (error) {
      logger.error(`图片生成失败:${name}:${error}`)
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
      logger.error(`图片生成为空:${name}`)
      return false
    }

    this.restart()

    return data.multiPage ? ret : ret[0]
  }

  /** 模板 */
  dealTpl (name, data) {
    let { tplFile, saveId = name } = data
    let savePath = `./temp/html/${name}/${saveId}.html`

    /** 读取html模板 */
    if (!this.html[tplFile]) {
      this.createDir(`./temp/html/${name}`)

      try {
        this.html[tplFile] = fs.readFileSync(tplFile, 'utf8')
      } catch (error) {
        logger.error(`加载html错误：${tplFile}`)
        return false
      }

      this.watch(tplFile)
    }

    data.resPath = `${_path}/resources/`

    /** 替换模板 */
    let tmpHtml = template.render(this.html[tplFile], data)

    /** 保存模板 */
    fs.writeFileSync(savePath, tmpHtml)

    logger.debug(`[图片生成][使用模板] ${savePath}`)

    return savePath
  }

  /** 监听配置文件 */
  watch (tplFile) {
    if (this.watcher[tplFile]) return

    const watcher = chokidar.watch(tplFile)
    watcher.on('change', path => {
      delete this.html[tplFile]
      logger.mark(`[修改html模板] ${tplFile}`)
    })

    this.watcher[tplFile] = watcher
  }

  /** 重启 */
  restart () {
    /** 截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢 */
    if (this.renderNum % this.restartNum === 0) {
      if (this.shoting.length <= 0) {
        setTimeout(async () => {
          if (this.browser) {
            await this.browser.close().catch((err) => logger.error(err))
          }
          this.browser = false
          logger.mark('puppeteer 关闭重启...')
        }, 100)
      }
    }
  }
}

