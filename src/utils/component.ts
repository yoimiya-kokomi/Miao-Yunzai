import React from 'react'
import { renderToString } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

type ComponentCreateOpsionType = {
  html_head?: string
  html_name?: string
  join_dir?: string
  html_body?: string
  file_create?: boolean
}

/**
 * ************
 * 组件解析
 * **********
 */
export class Component {
  #dir = ''
  constructor() {
    this.#dir = join(process.cwd(), 'html')
    mkdirSync(this.#dir, {
      recursive: true
    })
  }
  /**
   * 渲染字符串
   * @param element
   * @param name
   * @returns
   */
  create(element: React.ReactNode, options: ComponentCreateOpsionType) {
    const str = renderToString(element)
    const dir = join(this.#dir, options?.join_dir ?? '')
    mkdirSync(dir, { recursive: true })
    const address = join(dir, options?.html_name ?? 'hello.html')
    const DOCTYPE = '<!DOCTYPE html>'
    const Link = `<link rel="stylesheet" href="../public/output.css"></link>`
    const head = `<head>${options?.html_head ?? Link}</head>`
    const body = `<body> ${str} ${options?.html_body ?? ''}</body>`
    const html = `${DOCTYPE}<html>${head}${body}</html>`
    if (
      typeof options?.file_create == 'boolean' &&
      options?.file_create == false
    ) {
      return html
    }
    writeFileSync(address, html)
    return address
  }
}
