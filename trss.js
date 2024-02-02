console.log("正迁移到 TRSS-Yunzai")

import fs from "node:fs"
import { execSync } from "child_process"
import YAML from "yaml"

function exec(cmd) { try {
  console.log(`执行命令 [${cmd}]`)
  console.log(execSync(cmd).toString())
  return true
} catch (err) {
  console.error("执行", cmd, "失败", err)
  return false
}}

function rmdir(dir) { try {
  if (!fs.existsSync(dir)) return true
  for (const i of fs.readdirSync(dir))
    rm(`${dir}/${i}`)
  fs.rmdirSync(dir)
  return true
} catch (err) {
  console.error("删除", dir, "错误", err)
  return false
}}

function rm(file) { try {
  if (!fs.existsSync(file)) return true
  if (fs.statSync(file).isDirectory())
    return rmdir(file)
  fs.unlinkSync(file)
  return true
} catch (err) {
  console.error("删除", file, "错误", err)
  return false
}}

function readYaml(file) { try {
  if (!fs.existsSync(file)) return {}
  return YAML.parse(fs.readFileSync(file, "utf-8"))
} catch (err) {
  console.error("读取", file, "错误", err)
  return {}
}}

function writeYaml(file, data) { try {
  return fs.writeFileSync(file, YAML.stringify(data), "utf-8")
} catch (err) {
  console.error("写入", file, "错误", err)
  return false
}}

const bot = readYaml("config/config/bot.yaml")
const qq = readYaml("config/config/qq.yaml")

exec("git remote add trss https://gitee.com/TimeRainStarSky/Yunzai")
exec("git fetch trss main")
rm("config/config")
exec("git reset --hard")
exec("git clean -df")
exec("git checkout --track trss/main")
rm("plugins/ICQQ-Plugin")
exec("git clone https://gitee.com/TimeRainStarSky/Yunzai-ICQQ-Plugin plugins/ICQQ-Plugin")
if (qq.qq) writeYaml("config/ICQQ.yaml", { bot, token: [`${qq.qq}:${qq.pwd}:${qq.platform}`] })
rm("plugins/genshin")
exec("git clone https://gitee.com/TimeRainStarSky/Yunzai-genshin plugins/genshin")
exec("pnpm install --force")

console.log("迁移完成，请查看教程 启动协议端\nhttps://gitee.com/TimeRainStarSky/Yunzai")