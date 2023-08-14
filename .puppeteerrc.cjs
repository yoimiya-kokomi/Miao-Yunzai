const os = require("os")
const { existsSync } = require("fs")
let skipDownload = false
let executablePath
if (process.platform == "win32" && existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")) {
  skipDownload = true
  executablePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
} else if (process.platform == "linux" && existsSync("/usr/bin/chromium")) {
  skipDownload = true
  executablePath = "/usr/bin/chromium"
}
module.exports = { skipDownload, executablePath }