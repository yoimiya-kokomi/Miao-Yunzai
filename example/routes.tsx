import React from 'react'
import { type RouterType } from '../image/types.js'
import Hello from './hello.tsx'
/**
 * *********
 * 该应该放置于插件目录下，
 * 命名为 routes.jsx
 * 或 routes.tsx
 * 启动热开发时，将读取该配置
 * *********
 */
export default [
  {
    url: '/',
    element: <Hello data={{ name: 'word' }}></Hello>
  }
] as RouterType
