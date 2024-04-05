console.log("正迁移到 Miao-Yunzai")

import fs from "node:fs"
import { execSync } from "child_process"

function exec(cmd) { try {
  console.log(`执行命令 [${cmd}]`)
  console.log(execSync(cmd).toString())
  return true
} catch (err) {
  console.error("执行", cmd, "失败", err)
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

exec("git remote set-url origin https://gitee.com/yoimiya-kokomi/Miao-Yunzai.git")
mv("config/config", "config/config_trss")
rm("config/config")
exec("git reset --hard")
exec("git clean -df")
rm("plugins/ICQQ-Plugin")
rm("plugins/genshin")
exec("git fetch https://gitee.com/yoimiya-kokomi/Miao-Yunzai")
exec("git reset --hard origin/master")
exec("pnpm install --force")
console.log("迁移完成，请查看教程 启动协议端\nhttps://gitee.com/yoimiya-kokomi/Miao-Yunzai")
console.log("配置文件已复制到 config/config_trss 阿巴阿巴")
