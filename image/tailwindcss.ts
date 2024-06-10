import { exec } from 'child_process'
/**
 * **********
 * 生成css文件
 * **********
 */
exec(
  'tailwindcss -i ./src/input.css -o ./public/output.css --watch',
  (error, _, __) => {
    if (error) {
      //
    }
  }
)
