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

function rm(file) { try {
  if (!fs.existsSync(file)) return true
  return process.platform == "win32" ?
    exec(`rd /s /q "${file.replace(/\//g, "\\")}"`) :
    exec(`rm -rf "${file}"`)
} catch (err) {
  console.error("删除", file, "错误", err)
  return false
}}

function mv(file, target) { try {
  if (!fs.existsSync(file)) return false
  if (fs.existsSync(target)) rm(target)
  return fs.renameSync(file, target)
} catch (err) {
  console.error("移动", file, target, "错误", err)
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
exec("git reset --hard")
exec("git clean -df")
mv("config/config", "config/config_miao")
exec("git checkout --track trss/main")
rm("plugins/ICQQ-Plugin")
exec("git clone --depth 1 --single-branch https://gitee.com/TimeRainStarSky/Yunzai-ICQQ-Plugin plugins/ICQQ-Plugin")
if (qq.qq) writeYaml("config/ICQQ.yaml", { bot, token: [`${qq.qq}:${qq.pwd}:${qq.platform}`] })
rm("plugins/genshin")
exec("git clone --depth 1 --single-branch https://gitee.com/TimeRainStarSky/Yunzai-genshin plugins/genshin")
exec("pnpm install --force")

console.log("迁移完成，请查看教程 启动协议端\nhttps://gitee.com/TimeRainStarSky/Yunzai\n输入 node miao 回 Miao-Yunzai")
fs.writeFileSync("miao.js", `console.log("正迁移到 Miao-Yunzai")

import fs from "node:fs"
import { execSync } from "child_process"

function exec(cmd) { try {
  console.log(\`执行命令 [\${cmd}]\`)
  console.log(execSync(cmd).toString())
  return true
} catch (err) {
  console.error("执行", cmd, "失败", err)
  return false
}}

function rm(file) { try {
  if (!fs.existsSync(file)) return true
  return process.platform == "win32" ?
    exec(\`rd /s /q "\${file.replace(/\\//g, "\\\\")}"\`) :
    exec(\`rm -rf "\${file}"\`)
} catch (err) {
  console.error("删除", file, "错误", err)
  return false
}}

function mv(file, target) { try {
  if (!fs.existsSync(file)) return false
  if (fs.existsSync(target)) rm(target)
  return fs.renameSync(file, target)
} catch (err) {
  console.error("移动", file, target, "错误", err)
  return false
}}

mv("config/config_miao", "config/config")
exec("git reset --hard")
exec("git clean -df")
rm("plugins/ICQQ-Plugin")
rm("plugins/genshin")
exec("git checkout master")
exec("git branch -D main")
exec("pnpm install --force")

console.log("迁移完成")`, "utf-8")