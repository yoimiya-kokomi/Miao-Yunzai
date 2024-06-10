import React from 'react'
import { Component, Puppeteer } from '../src/utils/index.js'
import Hello from './hello.tsx'
const Com = new Component()
const Pup = new Puppeteer()
export class Image {
  constructor() {
    // 启动
    Pup.start()
  }
  /**
   *
   * @returns
   */
  async getHelloComponent() {
    // 生成 html 地址
    const Address = Com.create(<Hello data={{ name: 'word' }} />, {
      html_head: `<link rel="stylesheet" href="../public/output.css"></link>`,
      html_name: 'hello.html'
    })
    //
    const img = await Pup.render(Address)
    return img
  }
}
