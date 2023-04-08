import cfg from "../config/config.js"
import lodash from "lodash"
import chokidar from "chokidar"
import template from "art-template"
import puppeteer from "puppeteer"
import fs from "node:fs"
import path from "node:path"

class Puppeteer {
    #browser
    #isLock

    constructor() {
        this.browserConfig = { ...cfg.puppeteer }
        this.cwd = process.cwd()
        this.htmlDir = "./temp/html"
        this.html = {}
        this.watcher = {}
        this.createDir(this.htmlDir)
    }

    createDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            if (!this.createDir(path.dirname(dirPath))) {
                return false
            }
            fs.mkdirSync(dirPath)
        }
        return fs.statSync(dirPath).isDirectory()
    }

    checkBrowser() {
        return this.#browser?.isConnected() === true
    }

    async getBrowser() {
        if (this.checkBrowser()) {
            return this.#browser
        }

        if (this.#isLock) {
            return
        }

        this.#isLock = true

        logger.mark("[图片生成][浏览器]", "正在启动...")
        await puppeteer.launch(this.browserConfig).then((browser) => {
            browser.on("disconnected", () => {
                logger.warn("[图片生成][浏览器]", "连接已断开！")
            })
            this.#browser = browser
            logger.mark("[图片生成][浏览器]", "启动成功.")
        }).catch((error) => {
            logger.error("[图片生成][浏览器]", "启动失败.", error)
        })

        this.#isLock = false

        return this.#browser
    }

    dealTpl(name, data) {
        let { tplFile, saveId = name } = data
        let savePath = `${this.htmlDir}/${name}/${saveId}.html`

        if (!this.html[tplFile]) {
            this.createDir(`${this.htmlDir}/${name}`)

            try {
                this.html[tplFile] = fs.readFileSync(tplFile, "UTF-8")
            } catch (error) {
                logger.error(`[图片生成][模板][${name}]`, "加载HTML错误.", tplFile)
                return false
            }

            if (!this.watcher[tplFile]) {
                this.watcher[tplFile] = chokidar.watch(tplFile)
                this.watcher[tplFile].on("change", () => {
                    delete this.html[tplFile]
                    logger.mark(`[图片生成][模板][${name}]`, "修改HTML模板.", tplFile)
                })
            }
        }

        data.resPath = this.cwd + `/resources/`
        logger.debug(`[图片生成][模板][${name}]`, "使用HTML模板.", savePath)

        fs.writeFileSync(savePath, template.render(this.html[tplFile], data))

        return savePath
    }

    /**
     * @param data                  模板参数
     * @param data.tplFile          模板路径，必传
     * @param data.saveId           生成html名称，为空name代替
     * @param data.imgType          screenshot参数，生成图片类型：png、jpeg
     * @param data.quality          screenshot参数，图片质量 0-100，jpeg时可传，默认100
     * @param data.omitBackground   screenshot参数，隐藏默认的白色背景，背景透明
     * @param data.path             screenshot参数，截图保存路径
     */
    async screenshot(name, data = {}) {
        let start = Date.now()

        let browser = await this.getBrowser()
        if (browser?.isConnected() !== true) {
            return
        }

        let savePath = this.dealTpl(name, data)
        if (!fs.existsSync(savePath)) {
            return
        }

        let image
        await browser.newPage().then(async (page) => {
            try {
                await page.goto(
                    `file://${this.cwd}${lodash.trim(savePath, ".")}`,
                    data.pageGotoParams || {}
                )

                let body = await page.$("#container") || await page.$("body")

                let randData = {
                    type: "png",
                    omitBackground: data.omitBackground === true
                }

                if (data.imgType === "jpeg") {
                    randData.type = "jpeg"
                    randData.quality = data.quality || 100
                }

                if (data.path) {
                    randData.path = data.path
                }

                image = await body.screenshot(randData)
            } catch (error) {
                logger.error(`[图片生成][浏览器][${name}]`, "载入HTML失败！", error)
            } finally {
                page.close()
            }
        }).catch((error) => {
            logger.error(`[图片生成][浏览器][${name}]`, "新建页面失败！", error)
        })

        if (!Buffer.isBuffer(image)) {
            logger.error(`[图片生成][浏览器][${name}] `, "截图失败！")
            return
        }

        logger.mark(
            `[图片生成][${name}]`,
            logger.green((image.length / 1024).toFixed(2) + "kb"),
            logger.green(`${Date.now() - start}` + "ms")
        )

        return segment.image(image)
    }
}

export default new Puppeteer()
