# Miao-Yunzai

这里是Miao-Yunzai V4 测试仓库,

你应该积极使用 V3 ，它仍然是长期支持并维护的版本。

哪怕 V4 后续发布，V3仍然接受长期支持并维护。

在功能点未完成测试之前，仓库不会发布任何有关新功能信息。

> 必要环境 Windows/Linux + Chrome/Chromium/Edge

> 必要环境 Node.js>16.14.0 + Redis>5.0.0

推荐使用`18.18.2`版本，如果系统不支持，最低要求`16.14.0`,这是新版`puppeteer`的限制

## 使用教程

- 安装源码

```sh
git clone --depth=1 -b dev https://github.com/yoimiya-kokomi/Miao-Yunzai.git
```

- 进入目录

```sh
cd Miao-Yunzai
```

- 安装插件(计划移除中...)

```sh

git clone --depth=1 https://github.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
```

- 安装依赖

```sh
npm install pnpm -g
pnpm install
```

- 启动

```sh
npm run app
```

- 重新登录

```sh
npm run app login
```

- 进程托管

```sh
npm run start
```

- 杀死进程

```sh
npm run kill
```

## 新特性

支持TS、TSX环境，提供Miao-Yunzai完全的类型声明及其开发文档。

- 消息回调

[查看 开发示例](./example/apps.ts)

- 图片组件

你无需再写原生的html，React将为你进行组件和管理

[学习 React.js](https://react.docschina.org/)

你无需再写原生从css !

tailwindcss将识别plugins目录下的tsx和jsx文件

为你自动生成css , 存放在`./publick/output.css`

[学习 tailwindcss](https://www.tailwindcss.cn/)

> 插件间浏览器都将独立控制且互不影响

[查看 开发示例](./example/index.tsx)

> 执行尝试生产 html

```sh
npm run css
npx ts-node ./example/index.ts
```

> 热开发图片启动

```sh
npm run image
```

[查看 配置示例](./example/routes.tsx)

## 生成开发文档

```sh
npm run docs
```

浏览器打开文件`docs/index.html`

# 开发者需知

- 提交

```ts
/**
 * feature：新功能
 * update：更新某功能
 * fix：修补某功能
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

## 关于lib

将在未来逐渐放弃，在版本发布后，开发者需要有意识的对此变化做出调整.

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
