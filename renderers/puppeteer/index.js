import Puppeteer from './lib/puppeteer.js'

/**
 *
 * @param config 本地config.yaml的配置内容
 * @returns renderer 渲染器对象
 * @returns renderer.id 渲染器ID，对应renderer中选择的id
 * @returns renderer.type 渲染类型，保留字段，暂时支持image
 * @returns renderer.render 渲染入口
 */
export default function (config) {
  // TODO Puppeteer待简化重构
  const PuppeteerRender = new Puppeteer(config)

  return {
    id: 'puppeteer',
    type: 'image',
    async render (name, data) {
      return await PuppeteerRender.screenshot(name, data)
    }
  }
}