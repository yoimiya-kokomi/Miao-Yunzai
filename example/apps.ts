import { Messages } from '../src/core/index.js'
const message = new Messages({
  priority: 9000
})
message.response(/^你好/, async e => {
  e.reply('你好')
})
