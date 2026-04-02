import express from 'express';

import SumsubController from '@/controllers/Sumsub/Sumsub.controller';

import { requireAuth } from '../../middleware/auth';

export class SumsubRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post('/signup-api', requireAuth, SumsubController.signupApi);
    this.router.post('/signup-sdk', requireAuth, SumsubController.signupSdk);
    this.router.get('/kyc-status', requireAuth, SumsubController.getKycStatus);
    this.router.post('/webhook', SumsubController.webhookHandler);
  }
}

const sumsubRoutes = new SumsubRoutes();
export default sumsubRoutes.router;
