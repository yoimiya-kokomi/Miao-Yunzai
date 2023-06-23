import fs from "node:fs"
import cfg from "../config/config.js"
import express from "express"
import http from "http"

export default class WebSocketAdapter {
  request(req) {
    logger.info(`${logger.blue(`[${req.ip}]`)} HTTP ${req.method} 请求：${req.url} ${JSON.stringify(req.rawHeaders)}`)
    req.res.redirect("https://github.com/TimeRainStarSky/Yunzai")
  }

  async load() {
    const wss = {}
    for (const file of fs.readdirSync('./lib/adapter/WebSocket').filter(file => file.endsWith('.js'))) {
      try {
        let adapter = await import(`./WebSocket/${file}`)
        if (!adapter.default) continue
        adapter = new adapter.default()
        wss[file.replace(/.js$/, "")] = await adapter.load()
      } catch (e) {
        logger.mark(`加载 WebSocket 适配器错误：${file}`)
        logger.error(e)
      }
    }

    const app = express()
    app.get("*", this.request)
    app.post("*", this.request)
    const server = http.createServer(app)

    server.on("upgrade", (req, socket, head) => {
      for (const i of Object.keys(wss))
        if (req.url == `/${i}`)
          return wss[i].handleUpgrade(req, socket, head, conn => wss[i].emit("connection", conn, req))
    })

    server.listen(cfg.bot.port, () => {
      const host = server.address().address
      const port = server.address().port
      logger.mark(`启动 WebSocket 服务器：${logger.green(`ws://[${host}]:${port}`)}`)
      for (const i of Object.keys(wss))
        logger.info(`本机 ${i} 连接地址：${logger.blue(`ws://localhost:${port}/${i}`)}`)
    })
  }
}