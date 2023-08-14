const os = require("os");
const { existsSync } = require("fs");
const arch = os.arch();
let skipDownload = false;
let executablePath;

// win32 存在 Edge 优先选择
if (process.platform == "win32") {
  if (existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")) {
    skipDownload = true;
    executablePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  }
} else if (process.platform == "linux") {
  // 如果 arm64 架构且存在 Chromium，跳过下载
  if ((arch == "arm64" || arch == "aarch64") && existsSync("/usr/bin/chromium")) {
    skipDownload = true;
    executablePath = "/usr/bin/chromium";
  } else if (existsSync("/usr/bin/chromium")) {
    // 不论什么架构，如果存在 Chromium，跳过下载且配置路径
    skipDownload = true;
    executablePath = "/usr/bin/chromium";
  }
}

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  skipDownload,
  executablePath,
};