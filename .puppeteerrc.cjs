const os = require("os")
const { existsSync, realpathSync } = require("fs")
const { execSync } = require("child_process")
const arch = os.arch()

let skipDownload = false
let executablePath

if (process.platform == "linux" || process.platform == "android")
  for (const item of [
    "chromium",
    "chromium-browser",
    "chrome",
    "chrome-browser",
  ]) try {
    const chromiumPath = execSync(`command -v ${item}`).toString().trim()
    if (chromiumPath && existsSync(chromiumPath)) {
      executablePath = realpathSync(chromiumPath)
      break
    }
  } catch (err) {}

if (!executablePath) for (const item of [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
]) if (existsSync(item)) {
  executablePath = item
  break
}

if (executablePath || arch == "arm64" || arch == "aarch64") {
  (typeof logger == "object" ? logger : console).info(`[Chromium] ${executablePath}`)
  skipDownload = true
}

module.exports = { skipDownload, executablePath }