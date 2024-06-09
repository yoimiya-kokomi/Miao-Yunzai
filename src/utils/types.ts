import { type ScreenshotOptions, type PuppeteerLifeCycleEvent } from 'puppeteer'
import queryString from 'querystring'

/**
 *
 */
export interface ScreenshotFileOptions {
  SOptions?: {
    type: 'jpeg' | 'png' | 'webp'
    quality: number
  }
  tab?: string
  timeout?: number
}

/**
 *
 */
export interface ScreenshotUrlOptions {
  url: string
  time?: number
  rand?: ScreenshotOptions
  params?: queryString.ParsedUrlQueryInput
  tab?: string
  timeout?: number
  cache?: boolean
  waitUntil?: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[]
}
