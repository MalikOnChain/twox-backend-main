import express from 'express';

class PaymentsRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Coinsbuy removed, crypto flows use Fystack + internal ledger (/webhooks/fystack, /crypto).
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const paymentsRouter = new PaymentsRouter();
export default paymentsRouter.getRouter();
