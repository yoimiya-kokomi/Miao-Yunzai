<div align="center">

# TRSS-Yunzai

Yunzai 应用端，支持多账号，支持协议端：go-cqhttp、ComWeChat、GSUIDCore、ICQQ、QQ频道、微信、KOOK、Telegram、Discord

[![访问量](https://visitor-badge.glitch.me/badge?page_id=TimeRainStarSky.Yunzai&right_color=red&left_text=访%20问%20量)](https://github.com/TimeRainStarSky/Yunzai)
[![Stars](https://img.shields.io/github/stars/TimeRainStarSky/Yunzai?color=yellow&label=收藏)](../../stargazers)
[![Downloads](https://img.shields.io/github/downloads/TimeRainStarSky/Yunzai/total?color=blue&label=下载)](../../archive/main.tar.gz)
[![Releases](https://img.shields.io/github/v/release/TimeRainStarSky/Yunzai?color=green&label=发行版)](../../releases/latest)

[![访问量](https://profile-counter.glitch.me/TimeRainStarSky-Yunzai/count.svg)](https://github.com/TimeRainStarSky/Yunzai)

</div>

- 基于 [Miao-Yunzai](../../../../yoimiya-kokomi/Miao-Yunzai) 改造，需要同时安装 [miao-plugin](../../../../yoimiya-kokomi/miao-plugin)
- 开发文档：[docs 分支](../../tree/docs)

## TRSS-Yunzai 后续计划

先刨坑，但也许会咕咕咕

- 完善现有协议端
- 支持更多协议端

项目仅供学习交流使用，严禁用于任何商业用途和非法行为

## 使用方法

### 建议使用 TRSS Script 一键安装管理

- [🌌 TRSS](https://TRSS.me)
- [🔼 Vercel](https://TRSS-Script.Vercel.app)
- [🐱 GitHub](https://TimeRainStarSky.GitHub.io/TRSS_Script)
- [🇬 Gitee](https://Gitee.com/TimeRainStarSky/TRSS_Script)

### 手动安装

> 环境准备： Windows or Linux，Node.js（ [版本至少 v18 以上](http://nodejs.cn/download) ）， [Redis](https://redis.io/docs/getting-started/installation)

1.克隆项目并安装 genshin miao-plugin

请根据网络情况选择 Github 安装或 Gitee 安装

```
# 使用 Github
git clone --depth 1 https://github.com/TimeRainStarSky/Yunzai
cd Yunzai
git clone --depth 1 https://github.com/TimeRainStarSky/Yunzai-genshin plugins/genshin
git clone --depth 1 https://github.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin

# 使用Gitee
git clone --depth 1 https://gitee.com/TimeRainStarSky/Yunzai
cd Yunzai
git clone --depth 1 https://gitee.com/TimeRainStarSky/Yunzai-genshin plugins/genshin
git clone --depth 1 https://gitee.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin
```

2.安装 [pnpm](https://pnpm.io/zh/installation)，已安装的可以跳过

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

4.运行

```
node app
```

5.启动协议端：

<details><summary>go-cqhttp</summary>

下载运行 [go-cqhttp](https://docs.go-cqhttp.org)，选择反向 WebSocket，修改 `config.yml`，以下为必改项：

```
uin: 账号
password: '密码'
post-format: array
universal: ws://localhost:2536/go-cqhttp
```

</details>

<details><summary>ComWeChat</summary>

下载运行 [ComWeChat](https://justundertaker.github.io/ComWeChatBotClient)，修改 `.env`，以下为必改项：

```
websocekt_type = "Backward"
websocket_url = ["ws://localhost:2536/ComWeChat"]
```

</details>

<details><summary>GSUIDCore</summary>

下载运行 [GenshinUID 插件](http://docs.gsuid.gbots.work/#/AdapterList)，GSUIDCore 连接地址 修改为：

```
ws://localhost:2536/GSUIDCore
```

</details>

<details><summary>ICQQ</summary>

[TRSS-Yunzai ICQQ Plugin](../../../Yunzai-ICQQ-Plugin)

</details>

<details><summary>QQ频道</summary>

[TRSS-Yunzai QQGuild Plugin](../../../Yunzai-QQGuild-Plugin)

</details>

<details><summary>微信</summary>

[TRSS-Yunzai WeChat Plugin](../../../Yunzai-WeChat-Plugin)

</details>

<details><summary>KOOK</summary>

[TRSS-Yunzai KOOK Plugin](../../../Yunzai-KOOK-Plugin)

</details>

<details><summary>Telegram</summary>

[TRSS-Yunzai Telegram Plugin](../../../Yunzai-Telegram-Plugin)

</details>

<details><summary>Discord</summary>

[TRSS-Yunzai Discord Plugin](../../../Yunzai-Discord-Plugin)

</details>

<details><summary>代理</summary>

[TRSS-Yunzai Proxy Plugin](../../../Yunzai-Proxy-Plugin)

</details>

6.设置主人：发送 `#设置主人`，后台日志获取验证码并发送

## 致谢

|                           Nickname                            | Contribution         |
| :-----------------------------------------------------------: | -------------------- |
|         [Yunzai-Bot](../../../../Le-niao/Yunzai-Bot)          | 乐神的 Yunzai-Bot    |
|     [Miao-Yunzai](../../../../yoimiya-kokomi/Miao-Yunzai)     | 喵喵的 Miao-Yunzai   |