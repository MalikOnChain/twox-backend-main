import DepositWalletAddress from '@/models/crypto/WalletDepositAddresses';
import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import CryptoPriceService from '@/services/crypto/CryptoPrice.service';
import { logger } from '@/utils/logger';

/* eslint-disable */

class VaultodyWebhookService {
  public async handleTransactionApproved(request: TransactionApprovedResponseType) {
    logger.info('Transaction approved', request);
  }

  public async handleTransactionRejected(request: TransactionRejectedResponseType) {
    logger.info('Transaction rejected', request);
  }

  public async handleIncomingConfirmedCoinTx(request: IncomingConfirmedCoinTxResponseType) {
    try {
      const {
        blockchain,
        network,
        address,
        minedInBlock,
        amount,
        unit,
        transactionId,
        currentConfirmations,
        targetConfirmations,
      } = request.data.item;

      // Validate the transaction first
      await this.validateIncomingCoinTxWebhookParams({
        amount,
        unit,
        transactionId,
        blockchain,
        network,
        address,
        minedInBlock,
      });

      // Check for existing transaction to prevent duplicates
      const existingTransaction = await CryptoTransaction.findOne({ transaction_id: transactionId });

      if (existingTransaction) {
        logger.info(`Transaction ${transactionId} already processed. Skipping.`);

        // Only update balance if transaction is moving from pending to confirmed
        if (existingTransaction.status === 'PENDING' && currentConfirmations >= targetConfirmations) {
          const blockInfo = await this.extractBlockInfo(minedInBlock);

          // Use a transaction to ensure atomicity
          // Update transaction status first
          await existingTransaction.updateOne({
            status: 'confirmed',
            ...blockInfo,
            metadata: {
              ...existingTransaction.metadata,
              originalPayload: JSON.stringify(request),
            },
            error_details: null,
          });

          // Commented out balance update and event logging
          /*
          await UserModelService.increaseUserBalance(
            existingTransaction.userId,
            Number(existingTransaction.exchangedAmount),
          );

          await EventService.logEvent({
            userId: existingTransaction.user_id,
            eventType: EventTypeEnum.DEPOSIT,
            data: {
              amount: Number(existingTransaction.exchanged_amount),
              unit: existingTransaction.unit,
              transactionId: existingTransaction.transaction_id,
              blockchain: existingTransaction.blockchain,
              network: existingTransaction.network,
              address: existingTransaction.address,
              blockHeight: existingTransaction.block_height,
              blockHash: existingTransaction.block_hash,
              exchangedAmount: Number(existingTransaction.exchanged_amount),
            },
            transaction: T,
          });
          */
        }

        return existingTransaction;
      }

      // Find the wallet deposit address
      const walletAddress = await DepositWalletAddress.findOne({
        address,
        blockchain: blockchain.toLowerCase(),
        network: network.toLowerCase(),
      });

      if (!walletAddress) {
        throw new Error(`No wallet address found for address: ${address} and blockchain: ${blockchain}`);
      }

      // Get exchange rate and calculate exchanged amount
      const exchangeRate = await CryptoPriceService.getPriceInUSD(unit.toUpperCase() as CRYPTO_CURRENCY);
      const exchangedAmount = Number(amount) * exchangeRate;
      const blockInfo = await this.extractBlockInfo(minedInBlock);

      logger.info('exchangedAmount', exchangedAmount);
    } catch (error: any) {
      const transaction = await CryptoTransaction.findById(request.data.item.transactionId);
      if (transaction) {
        await transaction.updateOne({
          status: 'failed',
          error_details: error?.message || error?.response?.error?.message || error?.msg || JSON.stringify(error),
        });
        return transaction;
      }
      throw error;
    }
  }

  public async handleIncomingConfirmedTokenTx(request: IncomingConfirmedTokenTxResponseType) {
    try {
      const {
        blockchain,
        network,
        address,
        minedInBlock,
        transactionId,
        token,
        tokenType,
        currentConfirmations,
        targetConfirmations,
      } = request.data.item;

      // Check for existing transaction
      const existingTransaction = await CryptoTransaction.findById(transactionId);

      if (existingTransaction) {
        logger.info(`Transaction ${transactionId} already processed. Skipping.`);
        if (existingTransaction.status === 'PENDING' || existingTransaction.status === 'FAILED') {
          const blockInfo = await this.extractBlockInfo(minedInBlock);
          const status = currentConfirmations >= targetConfirmations ? 'COMPLETED' : 'PENDING';

          // Commented out balance update and event logging
          /*
          if (status === 'confirmed') {
            await UserModelService.increaseUserBalance(
              existingTransaction.userId,
              Number(existingTransaction.exchangedAmount)
            );
            await EventService.logEvent({
              userId: existingTransaction.userId,
              eventType: EventTypeEnum.DEPOSIT,
              data: {
                amount: Number(existingTransaction.exchangedAmount),
                unit: existingTransaction.unit,
                transactionId: existingTransaction.transactionId,
                blockchain: existingTransaction.blockchain,
                network: existingTransaction.network,
                address: existingTransaction.address,
                blockHeight: existingTransaction.blockHeight,
                blockHash: existingTransaction.blockHash,
              },
            });
          }
          */

          await existingTransaction.updateOne({
            status,
            ...blockInfo,
            metadata: {
              ...existingTransaction.metadata,
              originalPayload: JSON.stringify(request),
            },
            error_details: null,
          });
        }
        return existingTransaction;
      }

      // Find the wallet deposit address
      const walletAddress = await DepositWalletAddress.findOne({
        address,
        blockchain: blockchain.toLowerCase(),
        network: network.toLowerCase(),
      });

      if (!walletAddress) {
        throw new Error(`No wallet address found for address: ${address} and blockchain: ${blockchain}`);
      }

      const tokensAmount = token.tokensAmount;
      const tokenSymbol = token.tokenSymbol;

      // Get exchange rate and calculate exchanged amount
      const exchangeRate = await CryptoPriceService.getPriceInUSD(tokenSymbol.toUpperCase() as CRYPTO_CURRENCY);
      const exchangedAmount = Number(tokensAmount) * exchangeRate;
      const blockInfo = await this.extractBlockInfo(minedInBlock);
      logger.info('exchangedAmount', exchangedAmount);

      // Commented out transaction creation
      /*
      const transaction = await CryptoTransactionService.createTokenTransaction(
        walletAddress.userId,
        {
          type: 'deposit',
          transactionId,
          amount: Number(tokensAmount),
          address,
          blockchain: blockchain.toLowerCase() as BLOCKCHAIN_PROTOCOL_NAME_TYPE,
          network: network.toLowerCase() as DEV_NETWORKS | PROD_NETWORKS,
          unit: tokenSymbol.toUpperCase(),
          status: currentConfirmations >= targetConfirmations ? 'confirmed' : 'pending',
          exchangeRate,
          exchangedAmount,
          tokenContract: token.contract,
          tokenType,
          decimals: token.decimals,
          blockHeight: blockInfo.height,
          blockHash: blockInfo.hash,
          blockTimeStamp: blockInfo.timestamp,
        },
        request
      );
      */

      // Temporary return for now
      return {
        status: 'pending',
        transactionId,
        amount: Number(tokensAmount),
        address,
        blockchain: blockchain.toLowerCase(),
        network: network.toLowerCase(),
        unit: tokenSymbol.toUpperCase(),
      };
    } catch (error: any) {
      const transaction = await CryptoTransaction.findById(request.data.item.transactionId);
      if (transaction) {
        await transaction.updateOne({
          status: 'failed',
          error_details: error?.message || error?.response?.error?.message || error?.msg || JSON.stringify(error),
        });
        return transaction;
      }
      throw error;
    }
  }

  private async extractBlockInfo(minedInBlock: any) {
    return {
      height: minedInBlock.height,
      hash: minedInBlock.hash,
      timestamp: new Date(minedInBlock.timestamp * 1000),
    };
  }

  private async validateIncomingCoinTxWebhookParams({
    amount,
    unit,
    transactionId,
    blockchain,
    network,
    address,
    minedInBlock,
  }: any) {
    if (!amount || !unit || !transactionId || !blockchain || !network || !address || !minedInBlock) {
      throw new Error('Missing required parameters');
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount');
    }
  }
}

export default new VaultodyWebhookService();
