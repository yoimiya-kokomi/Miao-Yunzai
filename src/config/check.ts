import { execAsync, readJSON } from "./utils.js"

/**
 * 校验运行
 * @returns 
 */
export async function checkRun() {
  /**
   * 
   */
  if (process.argv[1].includes('pm2')) return
  /**
   * 
   */
  if (process.argv[1].includes('test')) return
  /**
   * 
   */
  const cfg = readJSON('./config/pm2/pm2.json')
  /**
   * 
   */
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
  }).catch(() => { })
}