import createQQ from './qq.js'
import setLog from './log.js'
import redisInit from './redis.js'
import { checkRun } from './check.js'
import fs from 'fs'
import yaml from 'yaml'

let path = './config/config/qq.yaml'

// 异步函数来读取 yaml 文件
async function getQQ () {
  function getQQPromise () {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const file = await fs.promises.readFile(path, 'utf8')
        const config = yaml.parse(file)
        resolve(config)
      } catch (err) {
        console.error(err)
        reject(err)
      }
    })
  }

  return getQQPromise().then((config) => {
    return config
  }).catch((err) => {
    console.log(err)
  })
}

/** 设置标题 */
process.title = `Miao-Yunzai ${(await getQQ()).qq === null ? '首次启动' : (await getQQ()).qq} ${(await getQQ()).platform === 1 ? '安卓手机' : (await getQQ()).platform === 2 ? 'aPad' : (await getQQ()).platform === 3 ? '安卓手表' : (await getQQ()).platform === 4 ? 'MacOS' : (await getQQ()).platform === 5 ? 'iPad' : 'Null'}`
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
    console.log('请先运行命令：pnpm install 安装依赖')
    process.exit()
  }

  /** 检查qq.yaml */
  await createQQ()

  /** 日志设置 */
  setLog()

  logger.mark('Miao-Yunzai 启动中...')

  await redisInit()

  checkRun()
}
