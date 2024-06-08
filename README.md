# Miao-Yunzai v3

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

> [开发相关](./DEV.md)

## 环境补充

### Centos

```sh
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y
```

- 字体

```sh
yum groupinstall fonts -y
```

- libstdc

下载 [libstdc++.so.6.0.29.zip](https://baiyin1314.lanzouq.com/i8Nr21ig8hyf)

将 **解压缩后** 的文件放在/usr/lib64/中

```sh
cd /usr/lib64/
sudo mv libstdc++.so.6 libstdc++.so.6.bak
sudo ln -s libstdc++.so.6.0.29 libstdc++.so.6
```

# Unknown file ".ts"

node >= 20.0.0

```ts
ts-node alemon.config.ts
```

更改为

```ts
node --no-warnings=ExperimentalWarning --loader ts-node/esm alemon.config.ts
```

## 致谢

|                           Nickname                            | Contribution         |
| :-----------------------------------------------------------: | -------------------- |
|      [Yunzai v3.0](https://gitee.com/le-niao/Yunzai-Bot)      | 乐神的Yunzai-Bot V3  |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源 |
|    [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)    | 角色攻略图来源       |
|  [米游社友人A](https://bbs.mihoyo.com/ys/collection/428421)   | 角色突破素材图来源   |
|            [icqq](https://github.com/icqqjs/icqq)             | ICQQ                 |
