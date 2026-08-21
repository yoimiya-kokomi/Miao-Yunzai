import "../config/init.js"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import PluginsLoader from "../plugins/loader.js"
import command from "./command.js"
import cfg from "../config/config.js"

/**
 * 终端交互式聊天，消息不发往QQ
 * 配置数据 config/test/default.yaml
 * 运行：node ./lib/tools/chat.js
 */

const savePath = "temp/chat"

/** 保存图片，返回文件路径 */
function saveImage(file) {
  if (!fs.existsSync(savePath)) fs.mkdirSync(savePath, { recursive: true })
  const name = `${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
  const filePath = path.join(savePath, name)
  fs.writeFileSync(filePath, file)
  return filePath
}

/** 把消息段转为可读文本 */
function formatMsg(msg) {
  if (msg === undefined || msg === null) return ""
  if (typeof msg == "string" || typeof msg == "number") return String(msg)
  if (Buffer.isBuffer(msg)) return `[图片 ${saveImage(msg)}]`
  if (Array.isArray(msg)) return msg.map(formatMsg).join("")

  switch (msg.type) {
    case "text":
      return msg.text
    case "at":
      return `[@${msg.qq}]`
    case "image": {
      if (Buffer.isBuffer(msg.file)) return `[图片 ${saveImage(msg.file)}]`
      return `[图片 ${msg.file?.url || msg.file || ""}]`
    }
    case "record":
      return "[语音]"
    case "face":
      return `[表情${msg.id}]`
    case "node":
      return `[转发消息]\n${formatMsg(msg.data)}`
    default:
      return msg.text || `[${msg.type || "未知消息"}]`
  }
}

/** 伪造 Bot，供插件读取 uin 等属性 */
const uin = 88888
global.Bot = {
  uin,
  nickname: "测试",
  fl: new Map(),
  gl: new Map(),
  pickUser: () => ({ sendMsg: msg => logger.info(`私聊回复 ${formatMsg(msg)}`) }),
  pickGroup: () => ({ sendMsg: msg => logger.info(`群回复 ${formatMsg(msg)}`) }),
}
global.Bot[uin] = global.Bot

/** 注册测试好友，否则私聊回复会被 loader 拦下 */
const testUser = Number(cfg.getYaml("test", "default")?.user_id) || 1145141919
global.Bot.fl.set(testUser, { user_id: testUser, nickname: "测试" })

/** 私聊模式：-p 或 --private */
const isPrivate = process.argv.some(i => i == "-p" || i == "--private")

/** 构造消息事件，复用 command.fakeE */
function makeEvent(text) {
  command.command = text
  const e = command.fakeE()
  e.self_id = uin

  const show = msg => {
    logger.info(`回复 ${formatMsg(msg)}`)
    return { message_id: `chat_${Date.now()}` }
  }

  e.reply = async msg => show(msg)

  if (isPrivate) {
    /** 私聊：清掉群信息，否则会被当成群消息 */
    e.message_type = "private"
    e.sub_type = "friend"
    delete e.group_id
    delete e.group_name
    delete e.group
    e.friend = {
      ...e.friend,
      sendMsg: msg => show(msg),
      recallMsg: () => {},
    }
  } else {
    e.group.sendMsg = msg => show(msg)
    e.group.recallMsg = () => {}
  }

  return e
}

await PluginsLoader.load()

logger.info("-----------")
logger.info("终端聊天已启动，输入内容回车发送")
logger.info("消息不会发往QQ，输入 exit 退出")
logger.info("-----------")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
})

let closed = false
rl.on("close", () => {
  closed = true
})

const prompt = () => {
  if (!closed) rl.prompt()
}

prompt()

for await (const line of rl) {
  const text = line.trim()

  if (!text) {
    prompt()
    continue
  }
  if (["exit", "quit"].includes(text)) break

  try {
    await PluginsLoader.deal(makeEvent(text))
  } catch (err) {
    logger.error("处理消息错误")
    logger.error(err)
  }

  prompt()
}

rl.close()
process.exit()
