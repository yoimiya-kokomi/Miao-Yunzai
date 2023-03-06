# Miao-Yunzai v3

基于乐神版[云崽v3.0](https://gitee.com/le-niao/Yunzai-Bot) 改造，**【尚未完全稳定，暂不建议使用】**

与原Yunzai独立的仓库，去除了较为敏感的签到功能，以尝试恢复[Github](https://github.com/yoimiya-kokomi/Miao-Yunzai.git)
环境。附加[Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git)

* 由于是独立新的仓库，只建议新部署/迁移，不建议原Bot直接换源
* 使用icqq登录，防止oicq可能出现的低版本问题（如只需要此特性，可使用[Yunzai-V3](https://gitee.com/yoimiya-kokomi/Yunzai-Bot) )
* 基础功能会保持与Yunzai同步迭代更新，如只需原版Yunzai无需切换

## Miao-Yunzai后续计划

先刨坑，但也许会咕咕咕

* 默认集成`miao-plugin`，部分功能进行整合或升级
    * 角色卡片、抽卡分析等使用`miao-plugin`版本
    * `miao-plugin`的帮助、设置、版本信息会升至`Miao-Yunzai`，以支持更多场景
* 一些底层会与`miao-plugin`做更深层的联动，以支持一些高级功能
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
#使用 Github 
git clone --depth=1 https://github.com/yoimiya-kokomi/Miao-Yunzai.git

#使用Gitee
git clone --depth=1 https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git
```

```
#进入Yunzai目录
cd Miao-Yunzai 
```

```
#使用Github
git clone --depth=1 https://github.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/

#使用Gitee
git clone --depth=1 https://gitee.com/yoimiya-kokomi/miao-plugin.git ./plugins/miao-plugin/
```

2.安装[pnpm](https://pnpm.io/zh/installation) ，已安装的可以跳过

```
npm install pnpm -g
```

3.安装依赖

```
pnpm install -P
```

4.运行（首次运行按提示输入登录）

```
node app
```

## 致谢

|                           Nickname                            | Contribution      |
|:-------------------------------------------------------------:|-------------------|
|      [Yunzai v3.0](https://gitee.com/le-niao/Yunzai-Bot)      | 乐神的Yunzai-Bot V3  |
| [GardenHamster](https://github.com/GardenHamster/GenshinPray) | 模拟抽卡背景素材来源        |
|      [西风驿站](https://bbs.mihoyo.com/ys/collection/839181)      | 角色攻略图来源           |
|     [米游社友人A](https://bbs.mihoyo.com/ys/collection/428421)     | 角色突破素材图来源         |
