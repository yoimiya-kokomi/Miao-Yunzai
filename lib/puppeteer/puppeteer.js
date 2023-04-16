import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cfg from '../config/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const rendererDir = path.join(__dirname, "../../renderers/");

let rendererBackends = {};

const rendererProxyHandler = {
  get(target, prop, receiver) {
    if (!(prop in receiver)) {
      logger.fatal("在类 " + target.constructor.name + " 上访问了未实现的方法或属性 " + prop + ", 请报告错误！");
      return undefined;
    }
    return Reflect.get(...arguments);
  },
}

async function registerRendererBackends() {
  const subFolders = fs.readdirSync(rendererDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());
  for (let subFolder of subFolders) {
    const newRendererBackends = (await import(path.join(rendererDir, subFolder.name, 'index.js'))).default;
    for (let rendererBackendName in newRendererBackends) {
      rendererBackends[rendererBackendName] = newRendererBackends[rendererBackendName];
      logger.mark("[渲染后端加载]: 导入 " + rendererBackendName);
    }
  }
}

function selectRendererBackend() {
  let rendererBackendName = cfg.renderer?.name;
  // 未指定，回退到 puppeteer
  if (!rendererBackendName) rendererBackendName = "puppeteer";
  let rendererBackendConstructor = rendererBackends[rendererBackendName];
  if (!rendererBackendConstructor) {
    logger.warn("未知的渲染后端 " + rendererBackendName + ", 回退到 puppeteer");
    rendererBackendName = "puppeteer";
    rendererBackendConstructor = rendererBackends[rendererBackendName];
  }
  if (!rendererBackendConstructor.isImportable()) {
    logger.warn("渲染后端 " + rendererBackendName + " 不可用 (导入失败), 回退到 puppeteer");
    rendererBackendName = "puppeteer";
    rendererBackendConstructor = rendererBackends[rendererBackendName];
  }
  logger.mark("当前渲染后端：" + rendererBackendName);
  return rendererBackendConstructor;
}

async function newRenderer() {
  // 自动扫描，并注册渲染后端
  await registerRendererBackends();
  // 选择渲染后端
  let rendererBackendConstructor = selectRendererBackend();
  return new rendererBackendConstructor();
}

export default new Proxy(await newRenderer(), rendererProxyHandler);
