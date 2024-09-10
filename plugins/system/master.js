import fs from "node:fs/promises"
import { ulid } from "ulid"
const code = {}
const file = "config/config/other.yaml"
export class master extends plugin {
  constructor() {
    super({
      name: "设置主人",
      dsc: "设置主人",
      event: "message",
      priority: -Infinity,
      rule: [
        {
          reg: "^#设置主人验证码$",
          fnc: "code",
          permission: "master",
        },
        {
          reg: "^#设置主人$",
          fnc: "master",
        }
      ]
    })
  }

  code() {
    let msg = ""
    for (const i in code)
      msg += `[${i}] ${code[i]}\n`
    return this.reply(msg.trim() || "暂无验证码", true)
  }

  async edit(file, key, value) {
    let data = await fs.readFile(file, "utf8")
    if (data.match(RegExp(`- "?${value}"?`)))
      return
    value = `${key}:\n  - "${value}"`
    if (data.match(RegExp(`${key}:`)))
      data = data.replace(RegExp(`${key}:`), value)
    else
      data = `${data}\n${value}`
    return fs.writeFile(file, data, "utf8")
  }

  master() {
    if (this.e.isMaster)
      return this.reply(`[${this.e.user_id}] 已经为主人`, true)

    code[`${this.e.self_id}:${this.e.user_id}`] = ulid()
    logger.mark(`${logger.cyan(`[${this.e.user_id}]`)} 设置主人验证码 ${logger.green(code[`${this.e.self_id}:${this.e.user_id}`])}`)
    this.setContext("verify")
    return this.reply(`[${this.e.user_id}] 请输入验证码`, true)
  }

  async verify() {
    this.finish("verify")
    if (this.e.msg?.trim().toUpperCase() === code[`${this.e.self_id}:${this.e.user_id}`]) {
      await this.edit(file, "masterQQ", this.e.user_id)
      await this.edit(file, "master", `${this.e.self_id}:${this.e.user_id}`)
      return this.reply(`[${this.e.user_id}] 设置主人完成`, true)
    } else {
      return this.reply("验证码错误", true)
    }
  }
}