import { PuppeteerLaunchOptions } from 'puppeteer';
import Puppeteer from './lib/puppeteer.js'
/**
 *
 * @param config
 * @returns renderer 渲染器对象
 * @returns renderer.id 渲染器ID，对应renderer中选择的id
 * @returns renderer.type 渲染类型，保留字段，暂时支持image
 * @returns renderer.render 渲染入口
 */
export default function (config?: PuppeteerLaunchOptions & {
  chromiumPath: string;
  puppeteerWS: any;
  puppeteerTimeout: any;
}) {
  // TODO Puppeteer待简化重构
  return new Puppeteer(config)
}