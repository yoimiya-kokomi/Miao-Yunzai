const os = require('os')
const { existsSync } = require('fs')
const { execSync } = require('child_process')
const arch = os.arch()

let skipDownload = false
let executablePath

if (process.platform === 'linux' || process.platform === 'android')
  for (const item of [
    "chromium",
    "chromium-browser",
    "chrome",
  ]) try {
    const chromiumPath = execSync(`command -v ${item}`).toString().trim()
    if (chromiumPath && existsSync(chromiumPath)) {
      executablePath = chromiumPath
      break
    }
  } catch (err) {}

// macOS
if (process.platform === 'darwin') for (const item of [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]) if (existsSync(item)) {
  executablePath = item
  break
}

if (!executablePath) for (const item of [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]) if (existsSync(item)) {
  executablePath = item
  break
}

if (executablePath || arch === 'arm64' || arch === 'aarch64') {
  (typeof logger == 'object' ? logger : console).info(`[Chromium] ${executablePath}`)
  skipDownload = true
}

module.exports = { skipDownload, executablePath }
