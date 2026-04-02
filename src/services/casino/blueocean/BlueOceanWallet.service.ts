import mongoose from 'mongoose';
import { logger } from '@/utils/logger';
import { GAME_CATEGORIES, GAME_TRANSACTION_STATUS, TRANSACTION_TYPES } from '@/types/game/game';

// Import models
import User from '@/models/users/User';
import GameTransactions from '@/models/transactions/GameTransactions';
import BlueOceanWalletTransaction from '@/models/slotGames/blueocean/BlueOceanWalletTransaction';
import BlueOceanGameSession from '@/models/slotGames/blueocean/BlueOceanGameSession';

export { BlueOceanWalletTransaction };

interface WalletOperationParams {
  remote_id: string;
  session_id: string;
  amount?: number;
  transaction_id: string;
}

interface WalletOperationResult {
  success: boolean;
  balance?: number;
  error?: string;
}

export class BlueOceanWalletService {
  /**
   * Get player balance
   */
  public static async getBalance(params: {
    remote_id: string;
    session_id: string;
  }): Promise<WalletOperationResult> {
    try {
      const { remote_id, session_id } = params;

      // Find user by remote_id (assuming remote_id is your user identifier)
      const user = await User.findOne({ 
        $or: [
          { _id: remote_id },
          { username: remote_id },
          { blueocean_remote_id: remote_id }
        ]
      });

      if (!user) {
        logger.error('User not found for BlueOcean balance request', { remote_id, session_id });
        return {
          success: false,
          balance: 0,
          error: 'User not found'
        };
      }

      logger.info('BlueOcean balance request successful', {
        remote_id,
        session_id,
        user_id: user._id,
        balance: user.balance || 0
      });

      return {
        success: true,
        balance: user.balance || 0,
      };
    } catch (error: any) {
      logger.error('Error getting BlueOcean wallet balance:', error);
      return {
        success: false,
        balance: 0,
        error: error.message || 'Internal server error'
      };
    }
  }

  /**
   * Debit player balance (place bet)
   */
  public static async debitBalance(params: WalletOperationParams): Promise<WalletOperationResult> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const { remote_id, session_id, amount, transaction_id } = params;

        if (!amount || amount <= 0) {
          throw new Error('Invalid amount for debit operation');
        }

        // Find user
        const user = await User.findOne({ 
          $or: [
            { _id: remote_id },
            { username: remote_id },
            { blueocean_remote_id: remote_id }
          ]
        }).session(session);

        if (!user) {
          throw new Error('User not found');
        }

        const balanceBefore = user.balance || 0;
        
        // Check if user has sufficient balance
        if (balanceBefore < amount) {
          throw new Error('Insufficient balance');
        }

        const balanceAfter = balanceBefore - amount;

        // Get game_id from session mapping
        const gameSession = await BlueOceanGameSession.findOne({ session_id }).session(session);
        const game_id = gameSession?.game_id;

        // Update user balance
        await User.findByIdAndUpdate(
          user._id,
          { balance: balanceAfter },
          { session }
        );

        // Update session last activity
        if (gameSession) {
          await BlueOceanGameSession.findByIdAndUpdate(
            gameSession._id,
            { last_activity: new Date() },
            { session }
          );
        }

        // Record the transaction
        await BlueOceanWalletTransaction.create([{
          remote_id,
          session_id,
          transaction_id,
          action: 'debit',
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          user_id: user._id,
          game_id,
          status: 'completed'
        }], { session });

        // Create a regular transaction record for your system
        await GameTransactions.create([{
          userId: user._id,
          category: GAME_CATEGORIES.SLOTS,
          betAmount: amount,
          winAmount: 0,
          type: TRANSACTION_TYPES.BET,
          status: GAME_TRANSACTION_STATUS.COMPLETED,
          game: {
            id: `blueocean_${transaction_id}`,
            name: 'BlueOcean Game',
            provider: 'BlueOcean'
          },
          userBalance: {
            before: balanceBefore,
            after: balanceAfter
          },
          description: `BlueOcean game bet - Transaction ID: ${transaction_id}`,
          metadata: {
            blueocean_transaction_id: transaction_id,
            blueocean_session_id: session_id,
            blueocean_remote_id: remote_id,
            action: 'debit'
          }
        }], { session });

        logger.info('BlueOcean debit transaction completed', {
          remote_id,
          session_id,
          transaction_id,
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter
        });

        return {
          success: true,
          balance: balanceAfter,
        };
      });
    } catch (error: any) {
      logger.error('Error processing BlueOcean debit transaction:', error);
      return {
        success: false,
        balance: 0,
        error: error.message || 'Failed to process debit transaction'
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Credit player balance (pay winnings)
   */
  public static async creditBalance(params: WalletOperationParams): Promise<WalletOperationResult> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const { remote_id, session_id, amount = 0, transaction_id } = params;

        // Find user
        const user = await User.findOne({ 
          $or: [
            { _id: remote_id },
            { username: remote_id },
            { blueocean_remote_id: remote_id }
          ]
        }).session(session);

        if (!user) {
          throw new Error('User not found');
        }

        const balanceBefore = user.balance || 0;
        const balanceAfter = balanceBefore + amount;

        // Get game_id from session mapping
        const gameSession = await BlueOceanGameSession.findOne({ session_id }).session(session);
        const game_id = gameSession?.game_id;

        // Update user balance
        await User.findByIdAndUpdate(
          user._id,
          { balance: balanceAfter },
          { session }
        );

        // Update session last activity
        if (gameSession) {
          await BlueOceanGameSession.findByIdAndUpdate(
            gameSession._id,
            { last_activity: new Date() },
            { session }
          );
        }

        // Record the transaction
        await BlueOceanWalletTransaction.create([{
          remote_id,
          session_id,
          transaction_id,
          action: 'credit',
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          user_id: user._id,
          game_id,
          status: 'completed'
        }], { session });

        // Create a regular transaction record for your system
        if (amount > 0) {
          await GameTransactions.create([{
            userId: user._id,
            category: GAME_CATEGORIES.SLOTS,
            betAmount: 0, // No bet for win transaction
            winAmount: amount, // Amount won
            type: TRANSACTION_TYPES.WIN,
            status: GAME_TRANSACTION_STATUS.COMPLETED,
            game: {
              id: `blueocean_${transaction_id}`,
              name: 'BlueOcean Game',
              provider: 'BlueOcean'
            },
            userBalance: {
              before: balanceBefore,
              after: balanceAfter
            },
            description: `BlueOcean game win - Transaction ID: ${transaction_id}`,
            metadata: {
              blueocean_transaction_id: transaction_id,
              blueocean_session_id: session_id,
              blueocean_remote_id: remote_id,
              action: 'credit'
            }
          }], { session });
        }

        logger.info('BlueOcean credit transaction completed', {
          remote_id,
          session_id,
          transaction_id,
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter
        });

        return {
          success: true,
          balance: balanceAfter,
        };
      });
    } catch (error: any) {
      logger.error('Error processing BlueOcean credit transaction:', error);
      return {
        success: false,
        balance: 0,
        error: error.message || 'Failed to process credit transaction'
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Rollback transaction (cancel transaction)
   */
  public static async rollbackTransaction(params: {
    remote_id: string;
    session_id: string;
    transaction_id: string;
  }): Promise<WalletOperationResult> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const { remote_id, session_id, transaction_id } = params;

        // Find the original transaction to rollback
        const originalTransaction = await BlueOceanWalletTransaction.findOne({
          transaction_id,
          remote_id,
          session_id,
          status: 'completed'
        }).session(session);

        if (!originalTransaction) {
          throw new Error('Transaction not found or already processed');
        }

        // Find user
        const user = await User.findOne({ 
          $or: [
            { _id: remote_id },
            { username: remote_id },
            { blueocean_remote_id: remote_id }
          ]
        }).session(session);

        if (!user) {
          throw new Error('User not found');
        }

        const currentBalance = user.balance || 0;
        let newBalance = currentBalance;

        // Reverse the transaction
        if (originalTransaction.action === 'debit') {
          // If original was debit, add the amount back
          newBalance = currentBalance + originalTransaction.amount;
        } else if (originalTransaction.action === 'credit') {
          // If original was credit, subtract the amount
          newBalance = currentBalance - originalTransaction.amount;
        }

        // Check for negative balance (shouldn't happen with proper validation)
        if (newBalance < 0) {
          throw new Error('Rollback would result in negative balance');
        }

        // Update user balance
        await User.findByIdAndUpdate(
          user._id,
          { balance: newBalance },
          { session }
        );

        // Mark original transaction as rolled back
        await BlueOceanWalletTransaction.findByIdAndUpdate(
          originalTransaction._id,
          { status: 'rolled_back' },
          { session }
        );

        // Create rollback transaction record
        await BlueOceanWalletTransaction.create([{
          remote_id,
          session_id,
          transaction_id: `${transaction_id}_rollback_${Date.now()}`,
          action: 'rollback',
          amount: originalTransaction.action === 'debit' ? originalTransaction.amount : -originalTransaction.amount,
          balance_before: currentBalance,
          balance_after: newBalance,
          user_id: user._id,
          status: 'completed'
        }], { session });

        // Create a regular transaction record for your system
        await GameTransactions.create([{
          userId: user._id,
          category: GAME_CATEGORIES.SLOTS,
          betAmount: originalTransaction.action === 'debit' ? originalTransaction.amount : 0,
          winAmount: originalTransaction.action === 'credit' ? originalTransaction.amount : 0,
          type: TRANSACTION_TYPES.REFUND,
          status: GAME_TRANSACTION_STATUS.COMPLETED,
          game: {
            id: `blueocean_${transaction_id}_rollback`,
            name: 'BlueOcean Game Rollback',
            provider: 'BlueOcean'
          },
          userBalance: {
            before: currentBalance,
            after: newBalance
          },
          description: `BlueOcean rollback - Original Transaction ID: ${transaction_id}`,
          metadata: {
            blueocean_original_transaction_id: transaction_id,
            blueocean_session_id: session_id,
            blueocean_remote_id: remote_id,
            original_action: originalTransaction.action,
            original_amount: originalTransaction.amount,
            action: 'rollback'
          }
        }], { session });

        logger.info('BlueOcean rollback transaction completed', {
          remote_id,
          session_id,
          transaction_id,
          original_action: originalTransaction.action,
          original_amount: originalTransaction.amount,
          balance_before: currentBalance,
          balance_after: newBalance
        });

        return {
          success: true,
          balance: newBalance,
        };
      });
    } catch (error: any) {
      logger.error('Error processing BlueOcean rollback transaction:', error);
      return {
        success: false,
        balance: 0,
        error: error.message || 'Failed to process rollback transaction'
      };
    } finally {
      await session.endSession();
    }
  }
}

