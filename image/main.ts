import Koa from 'koa'
import KoaStatic from 'koa-static'
import Router from 'koa-router'
import { Component } from '../src/utils/index.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import './tailwindcss.js'

const Com = new Component()
const app = new Koa()
const router = new Router()
const Port = 8080

// 得到plugins目录
const flies = readdirSync(join(process.cwd(), 'plugins'), {
  withFileTypes: true
}).filter(flie => !flie.isFile())

// 解析路由
for (const flie of flies) {
  const plugins = readdirSync(join(flie.path, flie.name), {
    withFileTypes: true
  }).filter(flie => flie.isFile())
  for (const plugin of plugins) {
    if (/^(routes.jsx|routes.tsx)$/.test(plugin.name)) {
      const routes = (await import(`file://${join(plugin.path, plugin.name)}`))
        ?.default
      if (!routes) continue
      if (Array.isArray(routes)) {
        for (const item of routes) {
          const url = `/${flie.name}${item.url}`
          console.log(`http://127.0.0.1:${Port}${url}`)
          router.get(url, ctx => {
            ctx.body = Com.create(item.element, {
              ...item.options,
              html_head: `${item?.html_head ?? ''}<link rel="stylesheet" href="/output.css">`,
              file_create: false
            })
          })
        }
      }
    }
  }
}

// static
app.use(KoaStatic('public'))

// routes
app.use(router.routes())

// listen 8000
app.listen(Port, () => {
  console.log('Server is running on port ' + Port)
})
