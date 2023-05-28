import createQQ from './qq.js'
import setLog from './log.js'
import redisInit from './redis.js'
import { checkRun } from './check.js'
import fs from 'node:fs'
import yaml from 'yaml'

/** 设置标题 */
process.title = 'Miao-Yunzai'

async function UpdateTitle() {
  // 添加一些多余的标题内容
  let title = 'Miao-Yunzai'
  let qq = await fs.promises.readFile('./config/config/qq.yaml', 'UTF-8').then(yaml.parse).catch(() => null)
  if (qq) {
    title += `@${qq.qq || ''}`
    switch (qq.platform) {
      case 1:
        title += ' 安卓手机'
        break
      case 2:
        title += ' aPad'
        break
      case 3:
        title += ' 安卓手表'
        break
      case 4:
        title += ' MacOS'
        break
      case 5:
        title += ' iPad'
        break
      case 6:
        title += ' 安卓8.8.88'
        break
      default:
    }
  }
  /** 设置标题 */
  process.title = title
}

/** 设置时区 */
process.env.TZ = 'Asia/Shanghai'

/** 捕获未处理的Promise错误 */
process.on('unhandledRejection', (error, promise) => {
  let err = error
  if (logger) {
    logger.error(err)
  } else {
    console.log(err)
  }
})

/** 退出事件 */
process.on('exit', async (code) => {
  if (typeof redis != 'undefined' && typeof test == 'undefined') {
    await redis.save()
  }
})

await checkInit()

/** 初始化事件 */
async function checkInit () {
  /** 检查node_modules */
  if (!fs.existsSync('./node_modules') || !fs.existsSync('./node_modules/icqq')) {
    console.log('请先运行命令：pnpm install -P 安装依赖')
    process.exit()
  }

  /** 检查qq.yaml */
  await createQQ()

  /** 日志设置 */
  setLog()

  logger.mark('Miao-Yunzai 启动中...')

  await redisInit()

  await checkRun()

  //** 更新标题 */
  await UpdateTitle()
}
