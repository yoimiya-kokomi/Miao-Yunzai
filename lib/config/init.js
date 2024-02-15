import createQQ from "./qq.js"
import setLog from "./log.js"
import redisInit from "./redis.js"
import { checkRun } from "./check.js"
import fs from "node:fs"
import yaml from "yaml"

/** 设置标题 */
process.title = "Miao-Yunzai"

async function UpdateTitle() {
  // 添加一些多余的标题内容
  let title = "Miao-Yunzai"
  let qq = await fs.promises.readFile("./config/config/qq.yaml", "UTF-8").then(yaml.parse).catch(() => null)
  if (qq) {
    title += `@${qq.qq || ""}`
    switch (qq.platform) {
      case 1:
        title += " 安卓手机"
        break
      case 2:
        title += " aPad"
        break
      case 3:
        title += " 安卓手表"
        break
      case 4:
        title += " MacOS"
        break
      case 5:
        title += " iPad"
        break
      case 6:
        title += " Tim"
        break
      default:
    }
  }
  /** 设置标题 */
  process.title = title
}

/** 设置时区 */
process.env.TZ = "Asia/Shanghai"

process.on("SIGHUP", () => process.exit())

/** 捕获未处理的错误 */
process.on("uncaughtException", error => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})

/** 捕获未处理的Promise错误 */
process.on("unhandledRejection", (error, promise) => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})

/** 退出事件 */
process.on("exit", async code => {
  if (typeof redis != "undefined" && typeof test == "undefined")
    await redis.save()

  if (typeof logger == "undefined")
    console.log("Miao-Yunzai 已停止运行")
  else
    logger.mark(logger.magenta("Miao-Yunzai 已停止运行"))
})

await checkInit()

/** 初始化事件 */
async function checkInit() {
  /** 检查node_modules */
  if (!fs.existsSync("./node_modules") || !fs.existsSync("./node_modules/icqq")) {
    console.log("请先运行命令：pnpm install -P 安装依赖")
    process.exit()
  }

  /** 检查qq.yaml */
  await createQQ()

  /** 日志设置 */
  setLog()

  logger.mark("Miao-Yunzai 启动中...")

  await redisInit()

  await checkRun()

  //** 更新标题 */
  await UpdateTitle()
}