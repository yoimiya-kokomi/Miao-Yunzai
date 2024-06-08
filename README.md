# Miao-Yunzai v3

基于乐神版[云崽v3.0](https://gitee.com/le-niao/Yunzai-Bot) 改造，需要同时安装[miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin.git) 

对数据结构进行了改造，无法直接迁回原版Yunzai，请根据自己需求情况慎重安装！

使用[icqq](https://github.com/icqqjs/icqq) 登录，防止oicq可能出现的低版本问题

## 使用方法

> 运行环境： Windows or Linux，Node.js（ [版本至少v16.14.0以上](http://nodejs.cn/download/) ）， [Redis](https://redis.io/docs/getting-started/installation/ )

> Node.js 版本请积极使用nvm进行管理

1.克隆项目并安装miao-plugin

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

2.安装[pnpm](https://pnpm.io/zh/installation) ，已安装的可以跳过

```sh
npm install pnpm -g
```

3.安装依赖
> 外网环境请注释修改.npmrc的本地npm配置
```sh
# 直接安装
pnpm install -P
```

4.运行（首次运行按提示输入登录）

```sh
node app
```

## 常见问题

<details><summary>展开/收起</summary>

### 无头浏览器相关

linux环境，其他环境请自行探索

```sh
puppeteer Chromium 启动中...
    Error: Failed to launch the browser process!
```

### 依赖库

```sh
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y
```

### 乱码字体

```sh
yum groupinstall fonts -y
```

### centos7 监听事件错误 "CXXABI_1.3.8" not found 解决办法

下载 [libstdc++.so.6.0.29.zip](https://baiyin1314.lanzouq.com/i8Nr21ig8hyf) 将 **解压缩后** 的文件放在/usr/lib64/中

```sh
cd /usr/lib64/
sudo mv libstdc++.so.6 libstdc++.so.6.bak
sudo ln -s libstdc++.so.6.0.29 libstdc++.so.6
```

</details>

## 与原版Yunzai-Bot的差异

**【注意】：** 由于是独立新的仓库，【只建议新部署/部署后迁移】，不建议原Bot直接换源强更

* **一些新特性：** Miao-Yunzai会逐步重构，增加新特性与功能，可能会有功能与形态上的变化。如期望功能更加稳定可使用此仓库[Yunzai-V3](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)
* **移除了签到功能：** 与原Yunzai独立的仓库，去除了较为敏感的签到功能，以尝试恢复[Github](https://github.com/yoimiya-kokomi/Miao-Yunzai.git)
  环境。附加[Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git)
* **默认启用喵版的功能：** 【#角色】【#深渊】【#帮助】等功能默认启用喵版，原版的逻辑会屏蔽，以便于后续逐步精简资源
* **一键迁移 TRSS-Yunzai：** 若无法登录QQ，可尝试 `node trss` 迁移，迁移后可登录其他协议端 [TRSS-Yunzai](https://gitee.com/TimeRainStarSky/Yunzai)

## Miao-Yunzai 的修改

[√] 角色卡片、抽卡分析等使用`miao-plugin`版本

[√] 星铁底层支持，原神&星铁多UID支持

项目仅供学习交流使用，严禁用于任何商业用途和非法行为

## 开发者

如果你是机器人插件生态开发的参与者，你可能需要阅读dev分支。

它有助于你了解数据类型和未来将要发展的版本。

## 致谢

|                           Nickname                            | Contribution     |
|:-------------------------------------------------------------:|------------------|
|      [Yunzai v3.0](https://gitee.com/le-niao/Yunzai-Bot)      | 乐神的Yunzai-Bot V3 |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源       |
|      [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)      | 角色攻略图来源          |
|     [米游社友人A](https://bbs.mihoyo.com/ys/collection/428421)     | 角色突破素材图来源        |
| [icqq](https://github.com/icqqjs/icqq) | ICQQ             |
