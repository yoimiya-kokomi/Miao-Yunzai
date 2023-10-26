console.log("正迁移到 TRSS-Yunzai\n")

import fs from "node:fs"
import { execSync } from "child_process"

function exec(cmd) { try {
  console.log(`执行命令 [${cmd}]\n`)
  console.log(execSync(cmd).toString())
  return true
} catch (err) {
  console.error(`错误：执行命令失败：${err}`)
  return false
}}

function rmFile(file) { try {
  console.log(`删除文件 [${file}]\n`)
  fs.unlinkSync(file)
  return true
} catch (err) {
  console.error(`错误：删除文件失败：${err}`)
  return false
}}

function rmDir(dir) { try {
  for (const i of fs.readdirSync(dir)) {
    const path = `${dir}/${i}`
    if (fs.statSync(path).isDirectory())
      rmDir(path)
    else
      rmFile(path)
  }
  console.log(`删除文件夹 [${dir}]\n`)
  fs.rmdirSync(dir)
  return true
} catch (err) {
  console.error(`错误：删除文件夹失败：${err}`)
  return false
}}

exec("git remote add trss https://gitee.com/TimeRainStarSky/Yunzai")
exec("git fetch trss main")
rmDir("config/config")
exec("git reset --hard")
exec("git clean -df")
exec("git checkout --track trss/main")
rmDir("plugins/genshin")
exec("git clone https://gitee.com/TimeRainStarSky/Yunzai-genshin plugins/genshin")
exec("pnpm i")

console.log("迁移完成，请查看教程 启动协议端\nhttps://gitee.com/TimeRainStarSky/Yunzai")