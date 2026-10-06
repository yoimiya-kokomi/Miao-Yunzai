import Shotium from "./lib/shotium.js"

/**
 * shotium 渲染后端
 * https://github.com/sj817/yunzai-renderer-shotium
 *
 * @param config 本地 config.yaml 的配置内容
 * @returns renderer 渲染器对象
 * @returns renderer.id 渲染器 ID，对应 renderer.yaml 中选择的 name
 * @returns renderer.type 渲染类型，目前只有 image
 * @returns renderer.render 渲染入口
 */
export default function (config) {
  return new Shotium(config)
}
