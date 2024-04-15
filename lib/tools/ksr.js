import { spawn } from 'child_process';
import log4js from 'log4js';
import http from 'http'
import YAML from 'yaml'
import fs from 'fs'

/* keep ssh run */

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: { default: { appenders: ['console'], level: 'debug' } }
});
const logger = log4js.getLogger('app');

let serverProcess;
const startServer = async () => {
  logger.info('Starting Bot...');
  serverProcess = spawn('node', ['app.js'], { stdio: 'inherit' });
  serverProcess.on('close', (code) => {
    logger.info(`Bot process exited with code ${code}`);
    if (code == null) return
    process.exit()
  });
};
startServer();

const serverHttpexit = http.createServer(async (req, res) => {
  let remoteIP = req.socket.remoteAddress;
  if (remoteIP.startsWith('::ffff:')) {
    remoteIP = remoteIP.slice(7);
  }
  if (remoteIP !== `::1` && remoteIP !== `127.0.0.1`) {
    console.log(remoteIP)
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Forbidden\n');
    return
  }
  if (req.url === `/restart`) {
    await serverProcess.kill();
    await startServer();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
  } else if (req.url === `/exit`) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
    process.exit()
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
})
let restart_port
try {
  restart_port = YAML.parse(fs.readFileSync(`./config/config/bot.yaml`, `utf-8`))
  restart_port = restart_port.restart_port || 27881
} catch {}

logger.info(`restart_api run on port ${restart_port || 27881}`)
serverHttpexit.listen(restart_port || 27881, () => { });
