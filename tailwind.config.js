// import { createRequire } from 'module'
// const require = createRequire(import.meta.url)
/**
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./plugins/**/*.{jsx,tsx}', './src/**/*.{jsx,tsx}'],
  theme: {
    extend: {}
  },
  plugins: []
}
