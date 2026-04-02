import { Request, Response, NextFunction } from 'express';
import BlockchainBalanceService from '@/services/blockchain/BlockchainBalance.service';
import { logger } from '@/utils/logger';

export class BlockchainBalanceController {
  /**
   * Get balance for a specific address on a blockchain
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { blockchain, address } = req.query;

      if (!blockchain || !address) {
        return res.status(400).json({
          success: false,
          error: 'blockchain and address are required',
        });
      }

      const balance = await BlockchainBalanceService.getBalance(
        blockchain as string,
        address as string
      );

      return res.json({
        success: true,
        data: {
          blockchain,
          address,
          balance,
        },
      });
    } catch (error) {
      logger.error('Failed to get blockchain balance:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch balance',
      });
    }
  }

  /**
   * Get balances for multiple addresses
   */
  async getMultipleBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const { addresses } = req.body;

      if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({
          success: false,
          error: 'addresses array is required',
        });
      }

      // Fetch all balances in parallel
      const balancePromises = addresses.map(async (item: { blockchain: string; address: string }) => {
        try {
          const balance = await BlockchainBalanceService.getBalance(
            item.blockchain,
            item.address
          );
          return {
            blockchain: item.blockchain,
            address: item.address,
            balance,
            success: true,
          };
        } catch (error) {
          logger.error(`Failed to fetch balance for ${item.blockchain}:`, error);
          return {
            blockchain: item.blockchain,
            address: item.address,
            balance: 0,
            success: false,
          };
        }
      });

      const results = await Promise.all(balancePromises);

      return res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error('Failed to get multiple balances:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch balances',
      });
    }
  }
}

export default new BlockchainBalanceController();

