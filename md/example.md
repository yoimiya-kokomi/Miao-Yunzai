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
