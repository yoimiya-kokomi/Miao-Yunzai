import React from 'react'
import { Component, Puppeteer } from '../src/utils/index.js'
import Hello, { type DataType } from './hello.tsx'
export const Com = new Component()
export const Pup = new Puppeteer()
export class Image {
  constructor() {
    // 启动
    Pup.start()
  }
  /**
   * 为指定用户生成html 生成指定数据下的html文件
   * @returns
   */
  getHelloComponent(uid: number, data: DataType) {
    // 生成 html 地址 或 html字符串
    const Address = Com.create(<Hello data={data} />, {
      /**
       * 注意，不设置json_dir时，
       * html_head路径应该是../public/output.css
       * 且html_head默认值路径也是../public/output.css
       * 因此，不增加其他head的话，html_head和join_dir都可以省略
       * { html_name: `${uid}.html`}
       */
      html_head: `<link rel="stylesheet" href="../../public/output.css"></link>`,
      // html/hello/uid.html
      join_dir: 'hello',
      html_name: `${uid}.html`
      // 不生成文件，返回的将是html字符串
      // file_create:false
    })
    return Pup.render(Address)
  }
}
export const imgae = new Image()
// render 是异步的，因此  此处也是异步的
await imgae.getHelloComponent(1715713638, { name: 'word' })
// e.reply(segment.buffer(img))
