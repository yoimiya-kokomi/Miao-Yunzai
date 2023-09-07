import '../config/init.js'
import log4js from 'log4js'
import PluginsLoader from '../plugins/loader.js'
import cfg from '../config/config.js'

class Command {
  constructor () {
    this.command = ''
    // this.setLog()
    /** 全局Bot */
    global.Bot = {}
  }

  /**
   * @param type 命令配置类型，默认default
   */
  async run (type = 'default') {
    /** 加载icqq事件监听 */
    await PluginsLoader.load()
    /** 获取命令行参数 */
    this.getCommand()
    /** 伪造消息 */
    let e = this.fakeE(type)

    /** 插件处理消息 */
    await PluginsLoader.deal(e)
  }

  /** 设置命令 */
  getCommand () {
    if (process.argv[2]) {
      this.command = '#' + process.argv[2].replace(/#|＃|井/g, '#').trim()
    }
  }

  fakeE (id = 'default') {
    /** 获取配置 */
    let data = cfg.getYaml('test', id)
    let text = this.command || data.text || ''
    logger.info(`测试命令 [${text}]`)
    let e = {
      test: true,
      self_id: 10000,
      time: new Date().getTime(),
      post_type: data.post_type || 'message',
      message_type: data.message_type || 'group',
      sub_type: data.sub_type || 'normal',
      group_id: data.group_id || 826198224,
      group_name: data.group_name || '测试群',
      user_id: data.user_id,
      user_avatar: `https://q1.qlogo.cn/g?b=qq&s=0&nk=${data.user_id}`,
      anonymous: null,
      message: [{ type: 'text', text }],
      raw_message: text,
      font: '微软雅黑',
      sender: {
        user_id: data.user_id,
        nickname: '测试',
        card: data.card,
        sex: 'male',
        age: 0,
        area: 'unknown',
        level: 2,
        role: 'owner',
        title: ''
      },
      group: {
        mute_left: 0,
        sendMsg: (msg) => {
          logger.info(`回复内容 ${msg}`)
        }
      },
      friend: {
        getFileUrl: (fid) => {
          return data.message[0].url
        }
      },
      message_id: 'JzHU0DACliIAAAD3RzTh1WBOIC48',
      reply: async (msg) => {
        logger.info(`回复内容 ${msg}`)
      },
      toString: () => {
        return text
      }
    }

    if (data.message) {
      e.message = data.message
    }

    return e
  }

  /** 日志 */
  setLog () {
    log4js.configure({
      appenders: {
        // 设置控制台输出 （默认日志级别是关闭的（即不会输出日志））
        out: {
          type: 'console',
          layout: {
            type: 'pattern',
            pattern: '[%d{hh:mm:ss.SSS}][%[%5.5p%]] - %m'
          }
        }
      },
      // 不同等级的日志追加到不同的输出位置：appenders: ['out', 'allLog']  categories 作为getLogger方法的键名对应
      categories: {
        // appenders:采用的appender,取上面appenders项,level:设置级别
        default: { appenders: ['out'], level: 'debug' }
      }
    })
    global.logger = log4js.getLogger('[test]')
    logger.level = 'debug'
  }
}

export default new Command()
