import fs from 'fs'
import { exec } from 'child_process'
import { join } from 'path'

/**
 * 校验运行
 * @returns 
 */
export async function checkRun() {
  /**
   * 
   */
  if (process.argv[1].includes('pm2')) return
  if (process.argv[1].includes('test')) return

  /**
   * 
   */
  const cfg = pm2Cfg()
  if (!cfg) return

  /**
   * 
   */
  execAsync(`pm2 show ${cfg.apps[0].name}`).then((status) => {
    /**
     * 
     */
    if (status.stdout.includes('online')) {
      logger.mark('检测到后台正在运行')
      logger.mark('已停止后台进程，防止重复运行')
      execAsync(`pm2 stop ${cfg.apps[0].name}`).catch(logger.error)
    }


  }).catch(()=>{})

}

/**
 * 
 * @param cmd 
 * @returns 
 */
function execAsync(cmd: string): Promise<{
  stdout: string,
  stderr: string
}> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(error)
      resolve({ stdout, stderr })
    })
  })
}

/**
 * 
 * @returns 
 */
function pm2Cfg() {
  try {
    const cfg = fs.readFileSync(join(process.cwd(), './config/pm2/pm2.json'), 'utf-8')
    return JSON.parse(cfg)
  } catch {
    return false
  }
}
