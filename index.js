import { exec, spawn } from 'child_process'
const argv = [...process.argv].splice(2)
const argvs = argv.join(' ').replace(/(\S+\.js|\S+\.ts)/g, '')

/**
 * **********
 * 生成css文件
 * **********
 */
exec(
  'tailwindcss -i ./src/input.css -o ./public/output.css',
  (error, stdout, stderr) => {
    if (error) {
      //
    }
  }
)

/**
 * ***************
 * 启动内部运行脚本
 * ***************
 */
const child = spawn(
  'node --no-warnings=ExperimentalWarning --loader ts-node/esm src/main.ts',
  argvs.split(' '),
  {
    shell: true,
    stdio: 'inherit'
  }
)
/**
 * *************
 * exit
 * *************
 */
process.on('SIGINT', () => {
  if (child.pid) process.kill(child.pid)
  if (process.pid) process.exit()
})
