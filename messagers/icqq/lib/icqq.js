import '../../../lib/config/init.js';
import cfg from '../../../lib/config/config.js';
import { Client } from "icqq";
import { segment } from 'icqq';

class ICQQClient extends Client {
  constructor() {
    super(cfg.bot)
  }

  login() {
    super.login(cfg.qq, cfg.pwd)
  }
}

const ICQQSegment = segment;

export { ICQQClient, ICQQSegment };
