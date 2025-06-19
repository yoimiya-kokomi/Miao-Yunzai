const arch = require("os").arch()
const { existsSync } = require("fs")
const { execSync } = require("child_process")

let skipDownload = false
let executablePath

if (["linux", "android"].includes(process.platform))
  for (const item of [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ]) try {
    const chromiumPath = execSync(`command -v ${item}`).toString().trim()
    if (chromiumPath && existsSync(chromiumPath)) {
      executablePath = chromiumPath
      break
    }
  } catch (err) {}

if (!executablePath) for (const item of [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]) if (existsSync(item)) {
  executablePath = item
  break
}

if (executablePath || arch == "arm64" || arch == "aarch64") {
  (typeof logger != "undefined" ? logger : console).info(`[Chromium] ${executablePath}`)
  skipDownload = true
}

module.exports = { skipDownload, executablePath }