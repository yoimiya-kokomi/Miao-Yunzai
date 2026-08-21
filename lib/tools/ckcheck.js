import readline from "node:readline"

/**
 * Cookie 字段体检工具
 * 只报告字段是否存在、是否为空，不输出任何字段值
 * 用法: node ./lib/tools/ckcheck.js  然后粘贴 cookie 回车
 */

/** accept() 接手绑定的两个条件，见 plugins/genshin/apps/user.js:71-88 */
const needToken = /(ltoken|ltoken_v2)/
const needUid = /(ltuid|login_uid|ltmid_v2|account_mid_v2|account_id_v2)/

/** noLogin 兜底规则，见 plugins/genshin/apps/user.js:27-30 */
const noLoginReg = /(.*)_MHYUUID(.*)/

function check(raw) {
  /** 去掉 prompt 复制带出的引号和首尾空白 */
  const ck = raw.trim().replace(/^['"]|['"]$/g, "")

  if (!ck) return

  const pairs = ck
    .split(";")
    .map(i => i.trim())
    .filter(i => i)
  const fields = new Map()
  for (const p of pairs) {
    const idx = p.indexOf("=")
    if (idx < 0) continue
    fields.set(p.slice(0, idx).trim(), p.slice(idx + 1).trim())
  }

  console.log(`\n共 ${fields.size} 个字段\n`)

  console.log("关键字段:")
  const keys = [
    "ltoken_v2",
    "ltoken",
    "ltuid_v2",
    "ltuid",
    "login_uid",
    "cookie_token_v2",
    "cookie_token",
    "account_id_v2",
    "account_mid_v2",
    "ltmid_v2",
  ]
  for (const k of keys) {
    if (!fields.has(k)) {
      console.log(`  ${k.padEnd(18)} 缺失`)
      continue
    }
    const v = fields.get(k)
    console.log(`  ${k.padEnd(18)} ${v ? `有值 (长度 ${v.length})` : "空值"}`)
  }

  /** 有值才算满足，空值等于没有 */
  const hasToken = [...fields].some(([k, v]) => needToken.test(k) && v)
  const hasUid = [...fields].some(([k, v]) => needUid.test(k) && v)

  console.log("\n判定:")
  console.log(`  ltoken 类字段  ${hasToken ? "满足" : "不满足"}`)
  console.log(`  ltuid 类字段   ${hasUid ? "满足" : "不满足"}`)

  if (hasToken && hasUid) {
    console.log("\n  => 会进入 bingCk 真实绑定流程")
  } else {
    console.log("\n  => accept() 不会接手，绑定不会触发")
    if (!hasToken) console.log("     原因: 缺少有值的 ltoken / ltoken_v2")
    if (!hasUid) console.log("     原因: 缺少有值的 ltuid 类字段")
    if (noLoginReg.test(ck)) console.log('     落入 noLogin，提示"请先登录米游社"')
    else console.log("     无规则匹配，静默无响应")
  }

  /** 空值字段统计，用于判断是否未登录状态取的 */
  const empty = [...fields].filter(([, v]) => !v).map(([k]) => k)
  if (empty.length) console.log(`\n空值字段 ${empty.length} 个: ${empty.join(", ")}`)
  console.log()
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

console.log("粘贴 cookie 后回车（不会输出任何字段值），exit 退出")
rl.setPrompt("> ")
rl.prompt()

rl.on("line", line => {
  if (line.trim() == "exit") return rl.close()
  try {
    check(line)
  } catch (err) {
    console.log(`解析失败: ${err.message}`)
  }
  rl.prompt()
})

rl.on("close", () => process.exit(0))
