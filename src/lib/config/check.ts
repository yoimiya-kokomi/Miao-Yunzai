import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { exec } = require('child_process')

export async function checkRun () {
  if (process.argv[1].includes('pm2')) return
  if (process.argv[1].includes('test')) return

  let cfg = pm2Cfg()
  let status = await execSync(`pm2 show ${cfg.apps[0].name}`)

  if (status.stdout.includes('online')) {
    logger.mark('检测到后台正在运行')
    logger.mark('已停止后台进程，防止重复运行')
    execSync(`pm2 stop ${cfg.apps[0].name}`)
  }
}

async function execSync (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}

function pm2Cfg () {
  let cfg = fs.readFileSync('./config/pm2/pm2.json')
  cfg = JSON.parse(cfg)
  return cfg
}
