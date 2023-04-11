
import cfg from "../config/config.js"
import chokidar from "chokidar"
import template from "art-template"
import puppeteer from "puppeteer"
import fs from "node:fs"
import path from "node:path"


class Puppeteer {
    #browser
    #isLock = false
    #sCount = 0

    constructor() {
        this.browserConfig = { ...cfg.puppeteer }
        this.cwd = process.cwd()
        this.htmlDir = this.cwd + "/temp/html"
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
        let savePath = this.htmlDir + `/${name}/${saveId}.html`

        if (!this.html[tplFile]) {
            try {
                this.createDir(path.dirname(savePath))
                this.html[tplFile] = fs.readFileSync(tplFile, "UTF-8")
            } catch (error) {
                logger.error(error)
                return
            }

            if (!this.watcher[tplFile]) {
                this.watcher[tplFile] = chokidar.watch(tplFile)
                this.watcher[tplFile].on("change", () => {
                    delete this.html[tplFile]
                    logger.mark(`[图片生成][${name}]`, "修改HTML模板.", tplFile)
                })
            }

        }

        data.resPath = this.cwd + `/resources/`
        logger.debug(`[图片生成][${name}]`, "使用HTML模板.", savePath)
        fs.writeFileSync(savePath, template.render(this.html[tplFile], data))
        return savePath
    }


    /**
     * @param data                  模板参数
     * @param data.tplFile          模板路径，必传
     * @param data.saveId           生成html名称，为空name代替
     * @param data.imgType          screenshot参数，生成图片类型：png、jpeg
     * @param data.quality          screenshot参数，图片质量 0-100，jpeg时可传，默认90
     * @param data.omitBackground   screenshot参数，隐藏默认的白色背景，背景透明
     * @param data.path             screenshot参数，截图保存路径
     * @param height                分片截图，单片长度
     */
    async screenshot(name, data = {}, height) {
        let start = Date.now()

        let browser = await this.getBrowser()
        if (browser?.isConnected() !== true) {
            return
        }


        let savePath = this.dealTpl(name, data)
        if (!fs.existsSync(savePath)) {
            return
        }

        if (process.platform === "win32") {
            savePath = "/" + savePath
        }

        let image = await browser.newPage().then(async (page) => {
            try {
                await page.goto("file://" + savePath, data.pageGotoParams || {})

                let body = await page.$("#container") || await page.$("body")

                let randData = {
                    type: data.type || "jpeg",
                    quality: data.quality || 90,
                    omitBackground: data.omitBackground === true,
                    path: data.path || ""
                }

                if (data.imgType === "png") {
                    delete randData.quality
                }

                if (!height) {
                    return await body.screenshot(randData)
                }


                let boundingBox = await body.boundingBox()
                let num = Math.ceil(boundingBox.height / height)


                if (num < 2) {
                    return [segment.image(await body.screenshot(randData))]
                }

                await page.setViewport({
                    width: boundingBox.width,
                    height: height
                })

                let image = []

                for (let i = 0; i < num; i++) {
                    image.push(segment.image(await page.screenshot(randData)))
                    await page.evaluate((height) => window.scrollBy(0, height), height)
                }

                return image
            } catch (error) {
                logger.error(error)
            } finally {
                page.close()
            }
        }).catch((error) => {
            logger.error(error)
        })

        if (!image) {
            logger.error(`[图片生成][${name}] `, "截图失败！")
            return
        }


        if (++this.#sCount % 100 === 0) browser.close()

        let log

        if (Array.isArray(image)) {
            log = "分片截图 " + logger.green(image.length + "片")

        } else {
            log = logger.green((image.length / 1024).toFixed(2) + "kb")
            image = segment.image(image)
        }

        logger.mark(`[图片生成][${this.#sCount}次][${name}]`, log, logger.green((Date.now() - start) + "ms"))

        return image
    }

    // height  单片长度，默认 4096
    async screenshots (name, data, height = 4096) {
        return await this.screenshot(name, data, height)
    }
}

export default new Puppeteer()
