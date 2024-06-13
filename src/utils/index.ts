export * from './config.js'
export * from './puppeteer.js'
export * from './types.js'
export * from './common.js'
export * from './component.js'

/**
 * 旧版本
 */
import puppeteer from './puppeteer/puppeteer.js'
export { puppeteer }

/**
 * ********
 *
 * **********
 */
import renderer from './renderer/loader.js'
import Renderer from './renderer/Renderer.js'
import renderers from './renderers/index.js'
import Renderers from './renderers/puppeteer.js'
export { Renderers, renderers, Renderer, renderer }

/**
 * puppeteer/
 * renderer/
 * renderers/
 * 是兼容性目录
 * 已废弃
 */
