// ==UserScript==
// @name         米游社/HoYoLAB Cookie 获取
// @namespace    miao-yunzai
// @version      1.0.0
// @description  读取含 HttpOnly 在内的完整 cookie，拼出 Miao-Yunzai 绑定所需字段
// @match        https://*.mihoyo.com/*
// @match        https://*.hoyolab.com/*
// @match        https://*.hoyoverse.com/*
// @grant        GM_cookie
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

;(function () {
  "use strict"

  /** accept() 接手绑定的两个条件，见 plugins/genshin/apps/user.js:71-88 */
  const needToken = ["ltoken", "ltoken_v2"]
  const needUid = ["ltuid", "login_uid", "ltmid_v2", "account_mid_v2", "account_id_v2"]

  /** 绑定与后续功能会用到的字段，按此顺序输出 */
  const wanted = [
    "ltoken_v2",
    "ltuid_v2",
    "ltmid_v2",
    "account_id_v2",
    "account_mid_v2",
    "cookie_token_v2",
    "ltoken",
    "ltuid",
    "cookie_token",
    "account_id",
    "login_ticket",
    "login_uid",
    "stoken",
    "stuid",
    "mid",
  ]

  const css = `
    #myz-ck-btn {
      position: fixed; right: 20px; bottom: 20px; z-index: 999999;
      padding: 10px 16px; border: 0; border-radius: 6px;
      background: #4a90d9; color: #fff; font-size: 14px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
    }
    #myz-ck-box {
      position: fixed; right: 20px; bottom: 70px; z-index: 999999;
      width: 460px; max-height: 70vh; overflow: auto; display: none;
      padding: 14px; border-radius: 8px;
      background: #1e1e1e; color: #ddd; font: 12px/1.6 monospace;
      box-shadow: 0 4px 20px rgba(0,0,0,.5);
    }
    #myz-ck-box h3 { margin: 0 0 8px; font-size: 13px; color: #fff }
    #myz-ck-box .ok { color: #6ac46a }
    #myz-ck-box .no { color: #e06c6c }
    #myz-ck-box textarea {
      width: 100%; height: 90px; margin-top: 8px; box-sizing: border-box;
      background: #111; color: #ddd; border: 1px solid #444; border-radius: 4px;
      font: 11px/1.5 monospace; resize: vertical;
    }
    #myz-ck-box button {
      margin: 8px 6px 0 0; padding: 6px 12px; border: 0; border-radius: 4px;
      background: #4a90d9; color: #fff; cursor: pointer; font-size: 12px;
    }
    #myz-ck-box .tip { margin-top: 8px; color: #999 }
  `

  const style = document.createElement("style")
  style.textContent = css
  document.head.appendChild(style)

  const btn = document.createElement("button")
  btn.id = "myz-ck-btn"
  btn.textContent = "获取 Cookie"
  document.body.appendChild(btn)

  const box = document.createElement("div")
  box.id = "myz-ck-box"
  document.body.appendChild(box)

  function esc(s) {
    return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
  }

  function render(list) {
    const map = new Map()
    for (const c of list) {
      /** 同名 cookie 可能存在于多个域，保留有值的那个 */
      if (!c.value) continue
      if (!map.has(c.name)) map.set(c.name, c.value)
    }

    const hasToken = needToken.some(n => map.has(n))
    const hasUid = needUid.some(n => map.has(n))
    const ck = wanted
      .filter(n => map.has(n))
      .map(n => `${n}=${map.get(n)}`)
      .join("; ")

    let html = `<h3>读到 ${list.length} 个 cookie，命中 ${wanted.filter(n => map.has(n)).length} 个关键字段</h3>`

    html += wanted
      .map(n => {
        const v = map.get(n)
        const cls = v ? "ok" : "no"
        const txt = v ? `有值 (长度 ${v.length})` : "缺失"
        return `<div><span class="${cls}">${v ? "✓" : "✗"}</span> ${n.padEnd(16).replace(/ /g, "&nbsp;")} ${txt}</div>`
      })
      .join("")

    html += `<div style="margin-top:8px">判定：
      <span class="${hasToken ? "ok" : "no"}">ltoken 类 ${hasToken ? "满足" : "不满足"}</span>　
      <span class="${hasUid ? "ok" : "no"}">ltuid 类 ${hasUid ? "满足" : "不满足"}</span></div>`

    html +=
      hasToken && hasUid
        ? `<div class="ok">可以绑定，复制下方内容私聊发给机器人</div>`
        : `<div class="no">不满足绑定条件，${hasToken ? "缺 ltuid 类字段" : "缺 ltoken 类字段"}，请确认已登录后重试</div>`

    html += `<textarea readonly>${esc(ck)}</textarea>`
    html += `<button id="myz-ck-copy">复制</button><button id="myz-ck-close">关闭</button>`
    html += `<div class="tip">当前域：${esc(location.hostname)}<br>这串内容等同账号登录态，不要发到群里或提交到仓库</div>`

    box.innerHTML = html
    box.style.display = "block"

    box.querySelector("#myz-ck-copy").onclick = () => {
      if (typeof GM_setClipboard == "function") GM_setClipboard(ck, "text")
      else box.querySelector("textarea").select(), document.execCommand("copy")
      box.querySelector("#myz-ck-copy").textContent = "已复制"
    }
    box.querySelector("#myz-ck-close").onclick = () => (box.style.display = "none")
  }

  function fail(msg) {
    box.innerHTML = `<h3 class="no">${esc(msg)}</h3>
      <div class="tip">GM_cookie 需要 Tampermonkey 4.11 以上版本。<br>
      Violentmonkey / Greasemonkey 不支持该接口，读不到 HttpOnly 字段。</div>
      <button id="myz-ck-close">关闭</button>`
    box.style.display = "block"
    box.querySelector("#myz-ck-close").onclick = () => (box.style.display = "none")
  }

  btn.onclick = () => {
    if (typeof GM_cookie == "undefined") return fail("当前脚本管理器不支持 GM_cookie")

    /** 不传 domain，按当前页面 URL 匹配，父域 cookie 一并返回 */
    GM_cookie.list({}, (cookies, error) => {
      if (error) return fail(`读取失败：${error}`)
      if (!cookies || !cookies.length) return fail("没有读到任何 cookie，确认已登录")
      render(cookies)
    })
  }
})()
