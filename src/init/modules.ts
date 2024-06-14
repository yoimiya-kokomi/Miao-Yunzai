import { existsSync } from 'fs'
import { join } from 'path'
const node_modules = join(process.cwd(), './node_modules')
/**
 * 检查node_modules
 */
if (!existsSync(node_modules)) {
  console.log('未安装依赖。。。。')
  console.log('请先运行命令：pnpm install -P 安装依赖')
  process.exit()
}
