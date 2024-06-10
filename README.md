# Miao-Yunzai v3

基于乐神版[云崽v3.0](https://gitee.com/le-niao/Yunzai-Bot) 改造，需要同时安装[miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin.git) 

对数据结构进行了改造，无法直接迁回原版Yunzai，请根据自己需求情况慎重安装！

使用[icqq](https://github.com/icqqjs/icqq) 登录，防止oicq可能出现的低版本问题

## 使用方法

[！点击阅读Miao-Yunzai文档了解更多](https://ningmengchongshui.github.io/Miao-Yunzai-Docs/)

> 必要环境 Windows/Linux + Chrome/Chromium/Edge

> 必要环境 Node.js>16.14.0 + Redis>5.0.0

> 推荐环境 Node.js=18.18.2 + Redis>6.0.0

> 推荐使用NVM对Node.js进行版本管理

### 克隆项目

> 请根据网络情况选择Github安装或Gitee安装

```sh
# 使用 Github 
git clone --depth=1 https://github.com/yoimiya-kokomi/Miao-Yunzai.git
cd Miao-Yunzai 
git clone --depth=1 https://github.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
```

```sh
# 使用Gitee
git clone --depth=1 https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git
cd Miao-Yunzai 
git clone --depth=1 https://gitee.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
```

### 安装[pnpm](https://pnpm.io/zh/installation)

> 已安装的可以跳过

```sh
npm install pnpm -g
```

###  安装依赖

> 外网环境请修改的本地npm配置.npmrc

```sh
# 直接安装
pnpm install -P
```

### 运行

> 首次运行按提示输入登录

```sh
npm run app
```

### 登录

```sh
npm run login
```

### 托管

```sh
npm run start
```
## 致谢

|                           Nickname                            | Contribution     |
|:-------------------------------------------------------------:|------------------|
|      [Yunzai v3.0](https://gitee.com/le-niao/Yunzai-Bot)      | 乐神的Yunzai-Bot V3 |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源       |
|      [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)      | 角色攻略图来源          |
|     [米游社友人A](https://bbs.mihoyo.com/ys/collection/428421)     | 角色突破素材图来源        |
| [icqq](https://github.com/icqqjs/icqq) | ICQQ             |
