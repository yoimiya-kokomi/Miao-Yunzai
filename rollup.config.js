import typescript from '@rollup/plugin-typescript'
/**
 * @type {import("rollup").RollupOptions}
 */
export default [
  {
    input: 'src/main.ts',
    output: {
      // file: 'index.js',
      dir: 'dist',
      format: 'module',
      sourcemap: false
    },
    plugins: [typescript()],
    onwarn: (warning, warn) => {
      if (warning.code === 'UNRESOLVED_IMPORT') return
      warn(warning)
    }
  }
]
