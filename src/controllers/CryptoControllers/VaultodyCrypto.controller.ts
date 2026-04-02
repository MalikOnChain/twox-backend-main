import { NextFunction, Request, Response } from 'express';

import VaultodyService from '@/services/crypto/Vaultody.service';
import VaultodyWebhookService from '@/services/crypto/VaultodyWebhook.service';
import UserWalletService from '@/services/user/Wallet.service';
import { VAULTODY_TX_EVENTS } from '@/types/global.enum';
import { logger } from '@/utils/logger';

export class VaultodyCryptoController {
  public async vaultodyWebhookHandler(req: Request, res: Response, next: NextFunction) {
    try {
      // Verify signature first
      logger.debug('vaultodyWebhookHandler', req.headers);

      // Only need to allow the vaultody.com host
      if (req.headers.origin !== 'https://vaultody.com' && !req.isTestMode) {
        logger.error('Invalid origin');
        res.status(401).json({ message: 'Invalid origin' });
        return;
      }

      const signature = req.header('x-signature');
      if (!signature) {
        logger.error('Missing signature');
        res.status(400).json({ message: 'Missing signature' });
        return;
      }

      const isValid = await VaultodyService.validateWebhook(signature, req.body);
      if (!isValid) {
        logger.error('Invalid signature');
        res.status(401).json({ message: 'Invalid signature' });
        return;
      }

      // Only process the webhook if signature is valid
      const { data = {} } = req.body;
      const { item, event } = data;

      if (!item || !event) {
        logger.error('Missing item or event');
        res.status(400).json({ message: 'Missing item or event' });
        return;
      }

      switch (event) {
        case VAULTODY_TX_EVENTS.TRANSACTION_APPROVED: {
          const approvedRequest = req.body as TransactionApprovedResponseType;
          await VaultodyWebhookService.handleTransactionApproved(approvedRequest);
          break;
        }
        case VAULTODY_TX_EVENTS.TRANSACTION_REJECTED: {
          const rejectedRequest = req.body as TransactionRejectedResponseType;
          await VaultodyWebhookService.handleTransactionRejected(rejectedRequest);
          break;
        }
        case VAULTODY_TX_EVENTS.INCOMING_CONFIRMED_COIN_TX: {
          const confirmedCoinRequest = req.body as IncomingConfirmedCoinTxResponseType;
          await VaultodyWebhookService.handleIncomingConfirmedCoinTx(confirmedCoinRequest);
          break;
        }
        case VAULTODY_TX_EVENTS.INCOMING_CONFIRMED_TOKEN_TX: {
          const confirmedTokenRequest = req.body as IncomingConfirmedTokenTxResponseType;
          await VaultodyWebhookService.handleIncomingConfirmedTokenTx(confirmedTokenRequest);
          break;
        }

        case VAULTODY_TX_EVENTS.TRANSACTION_REQUEST:
          break;
        case VAULTODY_TX_EVENTS.INCOMING_CONFIRMED_INTERNAL_TX:
          break;
        case VAULTODY_TX_EVENTS.INCOMING_MINED_TX:
          break;
        case VAULTODY_TX_EVENTS.OUTGOING_FAILED:
          break;
        case VAULTODY_TX_EVENTS.OUTGOING_MINED:
          break;
        case VAULTODY_TX_EVENTS.TRANSACTION_BROADCASTED:
          break;
        default:
          break;
      }
    } catch (error) {
      logger.error('Error in vaultodyWebhookHandler', error);
      next(error);
    }
  }

  public async generateDepositAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const { blockchain, context, label, network } = req.body;

      if (!blockchain || !label) {
        logger.error('Missing blockchain or label');
        res.status(400).json({ message: 'Missing blockchain or label' });
        return;
      }

      if (!req.isAuthenticated) {
        logger.error('User is not authenticated');
        res.status(401).json({ message: 'User is not authenticated' });
        return;
      }

      const address = await VaultodyService.generateDepositAddress({ blockchain, context, label, network });
      await UserWalletService.generateDepositAddress(req.user.id, blockchain, network, address);
      res.json(address);
    } catch (error) {
      logger.error('Error in generateDepositAddress', error);

      next(error);
    }
  }

  public async validateAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const { address, blockchain, network } = req.body;
      const result = await VaultodyService.validateAddress(address, blockchain, network);
      res.json(result);
    } catch (error) {
      logger.error('Error in validateAddress', error);
      next(error);
    }
  }
}

export default new VaultodyCryptoController();
