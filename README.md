<div align="center">

# TRSS-Yunzai

Yunzai 应用端，支持多账号，支持协议端：OneBotv11、ComWeChat、GSUIDCore、ICQQ、QQBot、QQ频道、微信、KOOK、Telegram、Discord、OPQBot、Lagrange

[![访问量](https://visitor-badge.glitch.me/badge?page_id=TimeRainStarSky.Yunzai&right_color=red&left_text=访%20问%20量)](https://github.com/TimeRainStarSky/Yunzai)
[![Stars](https://img.shields.io/github/stars/TimeRainStarSky/Yunzai?color=yellow&label=收藏)](../../stargazers)
[![Downloads](https://img.shields.io/github/downloads/TimeRainStarSky/Yunzai/total?color=blue&label=下载)](../../archive/main.tar.gz)
[![Releases](https://img.shields.io/github/v/release/TimeRainStarSky/Yunzai?color=green&label=发行版)](../../releases/latest)

[![访问量](https://profile-counter.glitch.me/TimeRainStarSky-Yunzai/count.svg)](https://github.com/TimeRainStarSky/Yunzai)

</div>

- 基于 [Miao-Yunzai](../../../../yoimiya-kokomi/Miao-Yunzai)
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

> 环境准备： Windows or Linux，[Node.js(>=v21)](http://nodejs.cn/download)，[Redis](https://redis.io/docs/getting-started/installation)

1. Git Clone 项目

请根据网络情况选择使用 GitHub 或 Gitee 安装

```sh
git clone --depth 1 https://github.com/TimeRainStarSky/Yunzai
git clone --depth 1 https://gitee.com/TimeRainStarSky/Yunzai
cd Yunzai
```

2. 推荐安装插件(可选)

```sh
git clone --depth 1 https://github.com/TimeRainStarSky/Yunzai-genshin plugins/genshin
git clone --depth 1 https://github.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin
git clone --depth 1 https://github.com/TimeRainStarSky/TRSS-Plugin plugins/TRSS-Plugin
```

```sh
git clone --depth 1 https://gitee.com/TimeRainStarSky/Yunzai-genshin plugins/genshin
git clone --depth 1 https://gitee.com/yoimiya-kokomi/miao-plugin plugins/miao-plugin
git clone --depth 1 https://Yunzai.TRSS.me plugins/TRSS-Plugin
```

3. 安装 [pnpm](https://pnpm.io/zh/installation) 和依赖

```sh
npm i -g pnpm
pnpm i
```

4. 前台运行

| 操作 | 命令 |
| ---- | ---- |
| 启动 | node . |
| 停止 | node . stop |

5. 启动协议端

<details><summary>WebSocket</summary><blockquote>

<details><summary>OneBotv11</summary><blockquote>

<details><summary>go-cqhttp</summary><blockquote>

  下载运行 [go-cqhttp](https://docs.go-cqhttp.org)，选择反向 WebSocket，修改 `config.yml`，以下为必改项：

  ```yaml
  uin: 账号
  password: '密码'
  post-format: array
  universal: ws://localhost:2536/OneBotv11
  ```

</blockquote></details>

<details><summary>LLOneBot</summary><blockquote>

  下载安装 [LLOneBot](https://github.com/LLOneBot/LLOneBot)，启用反向 WebSocket，添加地址：

  ```
  ws://localhost:2536/OneBotv11
  ```

</blockquote></details>

<details><summary>Shamrock</summary><blockquote>

  下载安装 [Shamrock](https://whitechi73.github.io/OpenShamrock)，启用被动 WebSocket，添加地址：

  ```
  ws://localhost:2536/OneBotv11
  ```

</blockquote></details>

<details><summary>Lagrange</summary><blockquote>

  下载运行 [Lagrange.OneBot](https://lagrangedev.github.io/Lagrange.Doc/Lagrange.OneBot)，修改 `appsettings.json` 中 `Implementations`：

  ```json
  {
    "Type": "ReverseWebSocket",
    "Host": "localhost",
    "Port": 2536,
    "Suffix": "/OneBotv11",
    "ReconnectInterval": 5000,
    "HeartBeatInterval": 5000,
    "AccessToken": ""
  }
  ```

</blockquote></details>

</blockquote></details>

<details><summary>ComWeChat</summary><blockquote>

下载运行 [ComWeChat](https://justundertaker.github.io/ComWeChatBotClient)，修改 `.env`，以下为必改项：

```python
websocekt_type = "Backward"
websocket_url = ["ws://localhost:2536/ComWeChat"]
```

<blockquote></details>

<details><summary>GSUIDCore</summary><blockquote>

下载运行 [GenshinUID 插件](http://docs.gsuid.gbots.work/#/AdapterList)，GSUIDCore 连接地址 修改为：

```
ws://localhost:2536/GSUIDCore
```

<blockquote></details>

<details><summary>OPQBot</summary><blockquote>

下载运行 [OPQBot](https://opqbot.com)，启动参数添加：

```
-wsserver ws://localhost:2536/OPQBot
```

</blockquote></details>

</blockquote></details>

<details><summary>插件</summary>

- [ICQQ](../../../Yunzai-ICQQ-Plugin)
- [QQBot](../../../Yunzai-QQBot-Plugin)
- [WeChat](../../../Yunzai-WeChat-Plugin)
- [KOOK](../../../Yunzai-KOOK-Plugin)
- [Telegram](../../../Yunzai-Telegram-Plugin)
- [Discord](../../../Yunzai-Discord-Plugin)
- [Route](../../../Yunzai-Route-Plugin)
- [Lagrange](../../../Yunzai-Lagrange-Plugin)

</details>

6. 设置主人：发送 `#设置主人`，日志获取验证码并发送

7. 使用 [pm2](https://pm2.keymetrics.io) 后台运行

| 操作 | 命令 |
| ---- | ---- |
| 启动 | pnpm start |
| 停止 | pnpm stop |
| 日志 | pnpm log |

8. 开机自启

```sh
pnpm start
pnpm pm2 save
pnpm pm2 startup
```

## 班级群(¿

1. [用户(897643592)](https://qm.qq.com/q/7NxbviGbj)
2. [开发者(833565573)](https://qm.qq.com/q/oFJR8VVECA)
3. [机器人(907431599)](https://qm.qq.com/q/oCBOrfE29U)

## 致谢

| Nickname | Contribution |
| -------- | ------------ |
| [Yunzai-Bot](../../../../Le-niao/Yunzai-Bot) | 乐神的 Yunzai-Bot |
| [Miao-Yunzai](../../../../yoimiya-kokomi/Miao-Yunzai) | 喵喵的 Miao-Yunzai |