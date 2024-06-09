# 开发者需知

未来将支持TS、TSX环境，提供Miao-Yunzai完全的类型声明及其开发文档。

- 提交

```ts
/**
 * feature：新功能
 * update：更新某功能
 * fixbug：修补某功能的bug
 * refactor：重构某个功能
 * optimize: 优化构建工具或运行时性能
 * style：仅样式改动
 * docs：仅文档新增/改动
 * chore：构建过程或辅助工具的变动
 */
```

- 注释风格

```ts
/**
 * 返回false
 * @param T 任意字符串
 * @returns false
 */
function getTest(T: string) {
  return false
}
```

- 命名风格

```ts
// 获得test值
function getTest(T: string) {}
// 设置
function setTest(T: string) {}
// 删除
function delTest(T: string) {}
// 获取某数据依据为id
function getDataById(T: string) {}

// 系统常量
const ENV_TEST = 'dev'

// 局域常量
const MyName = 'yunzai'

// 可修改变量
let values = ''

// 禁止使用 var values = ''

// 声明数组
const Arr = []

// 不推荐  new

// 声明对象
const Obj = {}

// 不推荐new
```

## 关于lib目录

lib目录将在未来逐渐放弃，在版本发布后，开发者需要有意识的对此变化做出调整.

```ts
// 已废弃
--lib / puppeteer
// 无扩展性，计划废弃
--lib / renderer
// 非机器人框架的核心处理代码
// 消耗服务器内存，无扩展性，计划废弃
--lib / tools / web.js / test.js / log.js / ksr.js
// 计划废弃
--renderers

// 其他内容逐步优化。。。
```

## 新版目录

- 核心源码

src/core

- 配置管理

src/config

- 数据管理

src/db

- 接口板块

src/mys

- 工具类

src/utils

## 新开发示例

- 图片组件

```tsx
import React from 'react'
export default function App() {
  return (
    <html>
      <head>
        <link rel="stylesheet" href="../css/output.css"></link>
      </head>
      <body>
        <div id="root">
          <div className="text-red-500 p-2 text-xl">Hello, world!</div>
        </div>
      </body>
    </html>
  )
}
```

```ts
import React from 'react'
import { renderToString } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
// puppeteer
import { Puppeteer } from './puppeteer.ts'
// component
import HelloComponent from './hello.tsx'
//
class Component {
  puppeteer: typeof Puppeteer.prototype
  #dir = ''
  constructor(dir: string) {
    this.puppeteer = new Puppeteer()
    this.#dir = dir
    mkdirSync(this.#dir, {
      recursive: true
    })
  }
  /**
   * 渲染字符串
   * @param element
   * @param name
   * @returns
   */
  create(element: React.ReactNode, dirs: string, name: string) {
    const html = renderToString(element)
    const dir = join(this.#dir, dirs)
    mkdirSync(dir, {
      recursive: true
    })
    const address = join(dir, name)
    writeFileSync(address, `<!DOCTYPE html>${html}`)
    return address
  }
  /**
   *  hello
   * @param _
   * @param name
   * @returns
   */
  hello() {
    return this.puppeteer.render(
      this.create(<HelloComponent />, 'hello', 'help.html')
    )
  }
}
```
