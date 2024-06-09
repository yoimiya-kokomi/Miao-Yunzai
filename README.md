# Miao-Yunzai

这里是Miao-Yunzai V4 测试仓库,

你应该积极使用 V3 ，它仍然是长期支持并维护的版本。

哪怕 V4 后续发布，V3仍然接受长期支持并维护。

在功能点未完成测试之前，仓库不会发布任何有关新功能信息。

> 必要环境 Windows/Linux + Chrome/Chromium/Edge

> 必要环境 Node.js>16.14.0 + Redis>5.0.0

推荐使用`18.18.2`版本，如果系统不支持，最低要求`16.14.0`,这是新版`puppeteer`的限制

## 开发者

> [开发相关](./md/developer.md)

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
