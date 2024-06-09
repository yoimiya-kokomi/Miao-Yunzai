import fs, { promises } from "node:fs"
import yaml from "yaml"
import { BOT_NAME, CONFIG_INIT_PATH } from "./system.js"
import createQQ from "./qq.js"
import setLog from "./log.js"
import redisInit from "./redis.js"
import { checkRun } from "./check.js"
import { join } from "node:path"

/**
 * 
 */
export async function UpdateTitle() {
  /**
   * 添加一些多余的标题内容
   */
  let title = BOT_NAME

  //
  const qq = await promises.readFile(`./${CONFIG_INIT_PATH}qq.yaml`, 'utf-8').then(yaml.parse).catch(() => null)

  /**
   * 
   */
  if (qq) {
    title += `@${qq.qq || ""}`
    switch (qq.platform) {
      case 1:{
        title += " 安卓手机"
        break
      }
      case 2:{
        title += " aPad"
        break
      }
      case 3:{
        title += " 安卓手表"
        break
      }
      case 4:{
        title += " MacOS"
        break
      }
      case 5:{
        title += " iPad"
        break
      }
      case 6:{
        title += " Tim"
        break
      }
      default:{
        break
      }
    }
  }

  /**
   * 设置标题
   */
  process.title = title
}

/**
 * 初始化事件
 */
export async function checkInit() {

  /**
   * 检查node_modules
   */
  if (!fs.existsSync(join(process.cwd(), "./node_modules"))) {
    console.log("未安装依赖。。。。")
    console.log("请先运行命令：pnpm install -P 安装依赖")
    process.exit()
  }

  /**
   * 检查node_modules/icqq
   */
  if(!fs.existsSync(join(process.cwd(), "./node_modules/icqq"))){
    console.log("未安装icqq。。。。")
    console.log("请先运行命令：pnpm install -P 安装依赖")
    process.exit()
  }

  /**
   * 检查qq.yaml
   */
  await createQQ()

  /**
   * 日志设置
   */
  setLog()

  /**
   * 
   */
  logger.mark(`${BOT_NAME} 启动中...`)

  /**
   * 
   */
  await redisInit()

  /**
   * 
   */
  await checkRun()

  /**
   * 更新标题
   */
  await UpdateTitle()
}


/**
 * 设置标题
 */
process.title = BOT_NAME

/**
 * 设置时区
 */
process.env.TZ = "Asia/Shanghai"

/**
 * 
 */
process.on("SIGHUP", () => process.exit())

/**
 * 捕获未处理的错误
 */
process.on("uncaughtException", error => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})


/**
 * 捕获未处理的Promise错误
 */
process.on("unhandledRejection", (error) => {
  if (typeof logger == "undefined") console.log(error)
  else logger.error(error)
})

/**
 * 退出事件
 */
process.on("exit", async () => {
  if (typeof redis != "undefined") {
    await redis.save()
  }
  if (typeof logger == "undefined") {
    console.log(`${BOT_NAME} 已停止运行`)
  }
  else {
    logger.mark(logger.magenta(`${BOT_NAME} 已停止运行`))
  }
})


/**
 * 初始化
 */
await checkInit()