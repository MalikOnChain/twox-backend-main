import { NextFunction, Request, Response } from 'express';
import { query, body } from 'express-validator';
import crypto from 'crypto';

import handleValidationErrors from '@/middleware/validation-error';
import { BlueOceanWalletService } from '@/services/casino/blueocean/BlueOceanWallet.service';
import { logger } from '@/utils/logger';

export class BlueOceanWalletController {
  /**
   * Validate BlueOcean wallet request signature
   */
  private validateSignature(queryParams: any): boolean {
    try {
      const { key, ...params } = queryParams;
      
      // Remove key from params and sort them
      const sortedParams = Object.keys(params)
        .sort()
        .map(param => `${param}=${params[param]}`)
        .join('&');
      
      // Generate expected signature
      const saltKey = process.env.BLUEOCEAN_SALT_KEY || '';
      const expectedKey = crypto.createHash('sha1').update(saltKey + sortedParams).digest('hex');
      
      return key === expectedKey;
    } catch (error) {
      logger.error('Error validating BlueOcean signature:', error);
      return false;
    }
  }

  /**
   * Get player balance
   * GET /api/wallet/balance?action=balance&remote_id=123&session_id=123-abc&key=SHA1_HASH
   */
  public getBalance = [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        console.log('getBalance============>', req.query);
        // Validate signature
        if (!this.validateSignature(req.query)) {
          logger.error('Invalid BlueOcean wallet signature', req.query);
          return res.status(401).json({
            status: '401',
            balance: '0',
            error: 'Invalid signature'
          });
        }

        const { remote_id, session_id } = req.query;

        if (!remote_id || !session_id) {
          return res.status(400).json({
            status: '400',
            balance: '0',
            error: 'Missing required parameters'
          });
        }

        const result = await BlueOceanWalletService.getBalance({
          remote_id: remote_id as string,
          session_id: session_id as string,
        });

        res.json({
          status: result.success ? '200' : '500',
          balance: result.balance || '0',
          error: result.error
        });
      } catch (error: any) {
        logger.error('Error getting BlueOcean wallet balance:', error);
        res.status(500).json({
          status: '500',
          balance: '0',
          error: error.message || 'Internal server error'
        });
      }
    },
  ];

  /**
   * Debit player balance (place bet)
   * GET /api/wallet/debit?action=debit&remote_id=123&amount=100&transactionid=12345&key=SHA1_HASH
   */
  public debitBalance = [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate signature
        if (!this.validateSignature(req.query)) {
          logger.error('Invalid BlueOcean wallet signature', req.query);
          return res.status(401).json({
            status: '401',
            balance: '0',
            error: 'Invalid signature'
          });
        }

        const { remote_id, session_id, amount, transactionid } = req.query;

        if (!remote_id || !session_id || !amount || !transactionid) {
          return res.status(400).json({
            status: '400',
            balance: '0',
            error: 'Missing required parameters'
          });
        }

        const result = await BlueOceanWalletService.debitBalance({
          remote_id: remote_id as string,
          session_id: session_id as string,
          amount: parseFloat(amount as string),
          transaction_id: transactionid as string,
        });

        res.json({
          status: result.success ? '200' : '500',
          balance: result.balance || '0',
          error: result.error
        });
      } catch (error: any) {
        logger.error('Error debiting BlueOcean wallet balance:', error);
        res.status(500).json({
          status: '500',
          balance: '0',
          error: error.message || 'Internal server error'
        });
      }
    },
  ];

  /**
   * Credit player balance (pay winnings)
   * GET /api/wallet/credit?action=credit&remote_id=123&amount=100&transactionid=12345&key=SHA1_HASH
   */
  public creditBalance = [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate signature
        if (!this.validateSignature(req.query)) {
          logger.error('Invalid BlueOcean wallet signature', req.query);
          return res.status(401).json({
            status: '401',
            balance: '0',
            error: 'Invalid signature'
          });
        }

        const { remote_id, session_id, amount, transactionid } = req.query;

        if (!remote_id || !session_id || !amount || !transactionid) {
          return res.status(400).json({
            status: '400',
            balance: '0',
            error: 'Missing required parameters'
          });
        }

        const result = await BlueOceanWalletService.creditBalance({
          remote_id: remote_id as string,
          session_id: session_id as string,
          amount: parseFloat(amount as string),
          transaction_id: transactionid as string,
        });

        res.json({
          status: result.success ? '200' : '500',
          balance: result.balance || '0',
          error: result.error
        });
      } catch (error: any) {
        logger.error('Error crediting BlueOcean wallet balance:', error);
        res.status(500).json({
          status: '500',
          balance: '0',
          error: error.message || 'Internal server error'
        });
      }
    },
  ];

  /**
   * Rollback transaction (cancel transaction)
   * GET /api/wallet/rollback?action=rollback&remote_id=123&transactionid=12345&key=SHA1_HASH
   */
  public rollbackTransaction = [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate signature
        if (!this.validateSignature(req.query)) {
          logger.error('Invalid BlueOcean wallet signature', req.query);
          return res.status(401).json({
            status: '401',
            balance: '0',
            error: 'Invalid signature'
          });
        }

        const { remote_id, session_id, transactionid } = req.query;

        if (!remote_id || !session_id || !transactionid) {
          return res.status(400).json({
            status: '400',
            balance: '0',
            error: 'Missing required parameters'
          });
        }

        const result = await BlueOceanWalletService.rollbackTransaction({
          remote_id: remote_id as string,
          session_id: session_id as string,
          transaction_id: transactionid as string,
        });

        res.json({
          status: result.success ? '200' : '500',
          balance: result.balance || '0',
          error: result.error
        });
      } catch (error: any) {
        logger.error('Error rolling back BlueOcean wallet transaction:', error);
        res.status(500).json({
          status: '500',
          balance: '0',
          error: error.message || 'Internal server error'
        });
      }
    },
  ];
}

export default new BlueOceanWalletController();

