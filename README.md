# Miao-Yunzai v3

基于乐神版[云崽v3.0](https://gitee.com/le-niao/Yunzai-Bot) 改造

需要同时安装[miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin.git) ，且后续的一些底层改造可能会改变数据结构，无法直接迁回原版Yunzai，请根据自己需求情况慎重安装

使用[icqq](https://github.com/icqqjs/icqq) 登录，防止oicq可能出现的低版本问题

---
与原版Yunzai-Bot的差异：

**【注意】：** 由于是独立新的仓库，【只建议新部署/部署后迁移】，不建议原Bot直接换源强更

* **一些新特性：** Miao-Yunzai会逐步重构，增加新特性与功能，可能会有功能与形态上的变化。如期望功能更加稳定可使用此仓库[Yunzai-V3](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)
* **移除了签到功能：** 与原Yunzai独立的仓库，去除了较为敏感的签到功能，以尝试恢复[Github](https://github.com/yoimiya-kokomi/Miao-Yunzai.git)
  环境。附加[Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git)
* **默认启用喵版的功能：** 【#角色】【#深渊】【#帮助】等功能默认启用喵版，原版的逻辑会屏蔽，以便于后续逐步精简资源

## Miao-Yunzai后续计划

先刨坑，但也许会咕咕咕

* 功能与`miao-plugin`部分功能进行整合或升级
    * [√] 角色卡片、抽卡分析等使用`miao-plugin`版本
    * `miao-plugin`的帮助、设置、版本信息会升至`Miao-Yunzai`，以支持更多场景
* 一些底层会与`miao-plugin`做更深层的联动，以支持一些高级功能
    * [√] 星铁底层支持，原神&星铁多UID支持
    * 基于面板信息的uid管理及认证
    * ck切换感知等
* 逐步实验一些新的特性
    * 更完备的plugin基础能力支持
    * 第三方 IM / Bot / WebAPI 对接或适配等

项目仅供学习交流使用，严禁用于任何商业用途和非法行为

## 使用方法

> 环境准备： Windows or Linux，Node.js（ [版本至少v16以上](http://nodejs.cn/download/) ）， [Redis](https://redis.io/docs/getting-started/installation/ )

1.克隆项目并安装miao-plugin

请根据网络情况选择Github安装或Gitee安装

```
# 使用 Github 
git clone --depth=1 https://github.com/yoimiya-kokomi/Miao-Yunzai.git
cd Miao-Yunzai 
git clone --depth=1 https://github.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/


# 使用Gitee
git clone --depth=1 https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git
cd Miao-Yunzai 
git clone --depth=1 https://gitee.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
```

2.安装[pnpm](https://pnpm.io/zh/installation) ，已安装的可以跳过

```
# 使用npmjs.org安装
npm install pnpm -g

# 指定国内源npmmirror.com安装
npm --registry=https://registry.npmmirror.com install pnpm -g
```

3.安装依赖

```
# 直接安装
pnpm install -P

# 如依赖安装缓慢或失败，可尝试更换国内npm源后再执行install命令
pnpm config set registry https://registry.npmmirror.com
pnpm install -P
```

4.运行（首次运行按提示输入登录）

```
node app
```

## 常见问题

### puppeteer 相关问题

linux环境，其他环境请自行探索

```sh
    puppeteer Chromium 启动中...
    Error: Failed to launch the browser process!
```

1. 先检查node版本是否大于14 (不大于14请去升级版本)

```sh
    node -v
```

2. 如果大于14 则可能是缺失一些库 请安装这些 (点击代码块右上角直接复制,如果报错可以尝试 sudo)

### 依赖库

```sh
    yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y
```

### 乱码字体解决办法（centos，安装不了请换源）

```sh
    yum groupinstall fonts -y
```

## 致谢

|                           Nickname                            | Contribution     |
|:-------------------------------------------------------------:|------------------|
|      [Yunzai v3.0](https://gitee.com/le-niao/Yunzai-Bot)      | 乐神的Yunzai-Bot V3 |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源       |
|      [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)      | 角色攻略图来源          |
|     [米游社友人A](https://bbs.mihoyo.com/ys/collection/428421)     | 角色突破素材图来源        |
| [icqq](https://github.com/icqqjs/icqq) | ICQQ             |
