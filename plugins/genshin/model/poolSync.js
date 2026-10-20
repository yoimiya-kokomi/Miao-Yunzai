import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { pathToFileURL } from "node:url"
import YAML from "yaml"

const poolFile = path.resolve("plugins/genshin/defSet/gacha/pool.yaml")
const cacheFile = path.resolve("plugins/genshin/defSet/gacha/pool.remote.json")
const lockFile = `${poolFile}.sync.lock`
// 每 6 小时检查一次，避免每次模拟抽卡都访问网络。
const syncInterval = 6 * 60 * 60 * 1000
// 主仓库为 yoimiya-kokomi/miao-plugin；本机存在时优先使用本地副本。
const sourceFile = path.resolve("plugins/miao-plugin/resources/meta-gs/info/pool.js")
const sourceUrl = "https://raw.githubusercontent.com/yoimiya-kokomi/miao-plugin/master/resources/meta-gs/info/pool.js"
let lastSync = 0

// 远程数据必须通过校验，防止接口变更时把错误内容写入 pool.yaml。
function validPool(pool) {
  return pool && typeof pool === "object" && Array.isArray(pool.char5) && Array.isArray(pool.weapon5) &&
    pool.char5.length > 0 && pool.weapon5.length > 0 && typeof pool.from === "string" && typeof pool.to === "string" &&
    Number.isFinite(Date.parse(pool.from)) && Number.isFinite(Date.parse(pool.to)) && Date.parse(pool.to) > Date.parse(pool.from)
}

function toYamlPool(poolDetail) {
  return poolDetail.filter(validPool).map(pool => ({
    up4: pool.char4 || [],
    up5: pool.char5.slice(0, 1),
    up5_2: pool.char5.slice(1),
    weapon5: pool.weapon5,
    weapon4: pool.weapon4 || [],
    endTime: pool.to,
  }))
}

async function loadPoolDetail() {
  if (fs.existsSync(sourceFile)) {
    const mod = await import(`${pathToFileURL(sourceFile).href}?v=${fs.statSync(sourceFile).mtimeMs}`)
    if (Array.isArray(mod.poolDetail)) return mod.poolDetail
  }
  const response = await fetch(sourceUrl, { headers: { "user-agent": "Yunzai-genshin-pool-sync" } })
  if (!response.ok) throw new Error(`远程卡池源返回 HTTP ${response.status}`)
  const text = await response.text()
  const temp = path.join(os.tmpdir(), `genshin-pool-${crypto.randomUUID()}.mjs`)
  try {
    fs.writeFileSync(temp, text, "utf8")
    const mod = await import(`${pathToFileURL(temp).href}?v=${Date.now()}`)
    return mod.poolDetail
  } finally {
    fs.rmSync(temp, { force: true })
  }
}

export async function syncPool(force = false) {
  if (!force && Date.now() - lastSync < syncInterval) return false
  lastSync = Date.now()
  try {
    if (fs.existsSync(lockFile)) return false
    fs.writeFileSync(lockFile, String(process.pid), "utf8")
    const detail = await loadPoolDetail()
    const pools = toYamlPool(detail)
    if (pools.length === 0) throw new Error("卡池源没有可用数据")
    const current = pools.find(pool => Date.parse(pool.endTime) >= Date.now())
    if (!current) throw new Error("卡池源没有当前或未来卡池")
    const yaml = YAML.stringify(pools)
    // 先写临时文件，再原子替换，避免进程中断留下半份配置。
    const temp = `${poolFile}.${process.pid}.tmp`
    fs.writeFileSync(temp, yaml, "utf8")
    fs.renameSync(temp, poolFile)
    fs.writeFileSync(cacheFile, JSON.stringify({ updatedAt: new Date().toISOString(), source: fs.existsSync(sourceFile) ? sourceFile : sourceUrl }, null, 2), "utf8")
    logger.mark(`[原神卡池] 已同步 ${current.up5.join("、")} / ${current.weapon5.join("、")}`)
    return true
  } catch (error) {
    // 同步失败不阻断抽卡，继续使用当前已经存在的本地卡池。
    logger.warn(`[原神卡池] 同步失败，继续使用本地配置：${error.message}`)
    return false
  } finally {
    fs.rmSync(lockFile, { force: true })
  }
}
