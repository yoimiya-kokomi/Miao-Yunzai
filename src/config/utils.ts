import fs from 'node:fs'
import { exec } from 'child_process'
import { join } from 'path'

/**
 * 休眠函数
 * @param ms 毫秒
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 *
 * @param cmd
 * @returns
 */
export function execAsync(cmd: string): Promise<{
  stdout: string
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
 * @param dir
 * @returns
 */
export function readJSON(dir: string) {
  try {
    const cfg = fs.readFileSync(join(process.cwd(), dir), 'utf-8')
    return JSON.parse(cfg)
  } catch {
    return false
  }
}
