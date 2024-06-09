# Miao-Yunzai

这里是Miao-Yunzai V4 测试仓库,

你应该积极使用 V3 ，它仍然是长期支持并维护的版本。

哪怕 V4 后续发布，V3仍然接受长期支持并维护。

在功能点未完成测试之前，仓库不会发布任何有关新功能信息。

> 必要环境 Windows/Linux + Chrome/Chromium/Edge

> 必要环境 18.18.2>Node.js>16.14.0 + Redis>5.0.0

如果你的系统不支持18.18.2版本，最低能下载16.14.0版本，这是最新的puppeteer版本限制。

## 使用教程

- 安装源码

```sh
git clone --depth=1 -b dev https://github.com/yoimiya-kokomi/Miao-Yunzai.git
```

- 安装依赖

```sh
npm install pnpm -g
pnpm install
```

- 启动

```sh
npm run ts:app
```

- 重新登录

```sh
npm run ts:app login
```

## 开发者

> [开发相关](./md/developer.md)

## Unknown file ".ts"

node >= 20.0.0

- 启动

```sh
npm run latest:app
```

- 重新登录

```sh
npm run latest:app login
```
