import EventListener from '../listener/listener.js'
import common from '../common/common.js'
import inquirer from 'inquirer'
import lodash from 'lodash'
import fetch from 'node-fetch'

/**
 * 监听上线事件
 */
let inSlider = false
export default class loginEvent extends EventListener {
  constructor () {
    super({
      prefix: 'system.login.',
      event: ['qrcode', 'slider', 'device', 'error'],
      once: false
    })
  }

  async execute (event) {
  }

  /** 扫码登录现在仅能在同一ip下进行 */
  async qrcode (event) {
    logger.mark(`请使用登录当前QQ的手机${logger.green('扫码')}完成登录，如果显示二维码过期，可以按${logger.green('回车键（Enter）')}刷新，重新输入密码请执行命令：${logger.green('node app login')}`)
    // logger.info('等待扫码中...')

    /** 获取扫码结果 */
    let time = 0
    let interval = setInterval(async () => {
      time++
      let res = await this.client.queryQrcodeResult()
      if (res.retcode === 0) {
        console.log('\n')
        logger.info(logger.green('扫码成功，开始登录...'))
        console.log('\n')
        await common.sleep(1000)
        this.client.qrcodeLogin()
        clearInterval(interval)
      }
      if (time >= 150) {
        clearInterval(interval)
        logger.error('等待扫码超时，已停止运行')
        process.exit()
      }
    }, 2000)

    /** 刷新二维码 */
    inquirer.prompt({ type: 'Input', message: '回车刷新二维码，等待扫码中...\n', name: 'enter' }).then(async () => {
      if (!inSlider) {
        clearInterval(interval)
        console.log('  重新刷新二维码...\n\n')
        await common.sleep(1000)
        this.client.fetchQrcode()
      }
    })
  }

  /**
   * 收到滑动验证码提示后，必须使用手机拉动，PC浏览器已经无效
   */
  async slider (event) {
    inSlider = true
    console.log(`\n\n------------------${logger.green('↓↓滑动验证链接↓↓')}----------------------\n`)
    console.log(logger.green(event.url))
    console.log('\n--------------------------------------------------------')
    console.log(`提示：打开上面链接获取ticket，可使用${logger.green('【滑动验证app】')}获取`)
    console.log(`链接存在${logger.green('有效期')}，请尽快操作，多次操作失败可能会被冻结`)
    console.log('滑动验证app下载地址：https://wwp.lanzouy.com/i6w3J08um92h 密码:3kuu\n')

    const ret = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '触发滑动验证，需要获取ticket通过验证，请选择获取方式:',
        choices: ['0.自动获取ticket', '1.手动获取ticket', '2.滑动验证app请求码获取']
      }
    ])

    await common.sleep(200)
    let ticket

    if (ret.type == '0.自动获取ticket') {
      ticket = await this.getTicket(event.url)
      if (!ticket) console.log('\n请求错误，返回手动获取ticket方式\n')
    }

    if (ret.type == '2.滑动验证app请求码获取') {
      ticket = await this.requestCode(event.url)
      if (!ticket) console.log('\n请求错误，返回手动获取ticket方式\n')
    }

    if (!ticket) {
      let res = await inquirer.prompt({
        type: 'Input',
        message: '请输入ticket:',
        name: 'ticket',
        validate (value) {
          if (!value) return 'ticket不能为空'
          if (value.toLowerCase() == 'ticket') return '请输入获取的ticket'
          if (value == event.url) return '请勿输入滑动验证链接'
          return true
        }
      })
      ticket = lodash.trim(res.ticket, '"')
    }
    global.inputTicket = true
    this.client.submitSlider(ticket.trim())
  }

   async getTicket (url) {
    let req = `https://hlhs-nb.cn/captcha/slider?key=${Bot.uin}`
    await fetch(req, {
      method: 'POST',
      body: JSON.stringify({ url })
    })

    console.log('\n----请打开下方链接并在2分钟内进行验证----')
    console.log(`${logger.green(req)}\n----完成后将自动进行登录----`)

    for (let i = 0; i < 40; i++) {
      let res = await fetch(req, {
        method: 'POST',
        body: JSON.stringify({ submit: Bot.uin })
      })
      res = await res.json()
      if (res.data?.ticket) return res.data.ticket
      await common.sleep(3000)
    }
  }

  async requestCode (url) {
    let txhelper = {
      url: url.replace('ssl.captcha.qq.com', 'txhelper.glitch.me')
    }
    txhelper.req = await fetch(txhelper.url).catch((err) => console.log(err.toString()))

    if (!txhelper.req?.ok) return false

    txhelper.req = await txhelper.req.text()
    if (!txhelper.req.includes('使用请求码')) return false

    txhelper.code = /\d+/g.exec(txhelper.req)
    if (!txhelper.code) return false

    console.log(`\n请打开滑动验证app，输入请求码${logger.green('【' + txhelper.code + '】')}，然后完成滑动验证\n`)

    await common.sleep(200)
    await inquirer.prompt({
      type: 'Input',
      message: '验证完成后按回车确认，等待在操作中...',
      name: 'enter'
    })

    txhelper.res = await fetch(txhelper.url).catch((err) => console.log(err.toString()))
    if (!txhelper.res) return false
    txhelper.res = await txhelper.res.text()

    if (!txhelper.res) return false
    if (txhelper.res == txhelper.req) {
      console.log('\n未完成滑动验证')
      return false
    }

    console.log(`\n获取ticket成功：\n${txhelper.res}\n`)
    return lodash.trim(txhelper.res)
  }

  /** 设备锁 */
  async device (event) {
    global.inputTicket = false
    console.log(`\n\n------------------${logger.green('↓↓设备锁验证↓↓')}----------------------\n`)
    const ret = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '触发设备锁验证，请选择验证方式:',
        choices: ['1.网页扫码验证', '2.发送短信验证码到密保手机']
      }
    ])

    await common.sleep(200)

    if (ret.type == '1.网页扫码验证') {
      console.log('\n' + logger.green(event.url) + '\n')
      console.log('请打开上面链接，完成验证后按回车')
      await inquirer.prompt({ type: 'Input', message: '等待操作中...', name: 'enter' })
      await this.client.login()
    } else {
      console.log('\n')
      this.client.sendSmsCode()
      await common.sleep(200)
      logger.info(`验证码已发送：${event.phone}\n`)
      let res = await inquirer.prompt({ type: 'Input', message: '请输入短信验证码:', name: 'sms' })
      await this.client.submitSmsCode(res.sms)
    }
  }

  /** 登录错误 */
  error (event) {
    if (Number(event.code) === 1) logger.error('QQ密码错误，运行命令重新登录：node app login')
    if (global.inputTicket && event.code == 237) {
      logger.error(`${logger.red('ticket')}输入错误或者已失效，已停止运行，请重新登录验证`)
    } else if (event?.message.includes('冻结')) {
      logger.error('账号已被冻结，已停止运行')
    } else {
      logger.error('登录错误，已停止运行')
    }

    process.exit()
  }
}
