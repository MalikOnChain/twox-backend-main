import crypto from 'crypto';

import express from 'express';

import NexusGGRService from '@/services/casino/Nexusggr/Nexusggr.service';
import NexusDemoService from '@/services/casino/Nexusggr/NexusggrFun.service';
import { logger } from '@/utils/logger';

export class CallbackHandler {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/nexusggr/gold_api', this.handleNexusGGR.bind(this));
    this.router.post('/nexusggr/demo/gold_api', this.handleNexusGGRDemo.bind(this));
  }

  async handleNexusGGR(req, res, next) {
    try {
      const response = await NexusGGRService.handleCallback(req, res);
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async handleNexusGGRDemo(req, res, next) {
    try {
      const response = await NexusDemoService.handleCallback(req, res);
      logger.debug('nexusggr demo return', response);
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  parseTransactionStatus(rawStatus) {
    return rawStatus >= 100 || rawStatus === 2 ? 3 : rawStatus < 0 ? 2 : rawStatus >= 0 && rawStatus < 100 ? 1 : null;
  }

  parseWithdrawStatus(rawStatus) {
    return rawStatus === 2 ? 3 : rawStatus < 0 ? 2 : rawStatus >= 0 && rawStatus < 2 ? 1 : null;
  }

  generateVaultodySignature(payload, secretKey) {
    return crypto.createHmac('sha256', secretKey).update(JSON.stringify(payload)).digest('hex');
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const callbackHandler = new CallbackHandler();
export default callbackHandler.getRouter();
