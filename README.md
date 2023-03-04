# Miao-Yunzai v3
基于乐神版[云崽v3.0](https://gitee.com/le-niao/Yunzai-Bot) 改造
在原版的基础上使用icqq登录，去除了较为敏感的签到等功能

【尚未完全稳定，暂不建议使用】


项目仅供学习交流使用，严禁用于任何商业用途和非法行为


## 使用方法
>环境准备： Windows or Linux，Node.js（[版本至少v16以上](http://nodejs.cn/download/)），[Redis](https://redis.io/docs/getting-started/installation/)

1.克隆项目
```
git clone --depth=1 -b main https://github.com/Le-niao/Yunzai-Bot.git
```
```
cd Yunzai-Bot #进入Yunzai目录
```
2.安装[pnpm](https://pnpm.io/zh/installation)，已安装的可以跳过
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
