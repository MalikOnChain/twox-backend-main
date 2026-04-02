import express from 'express';

import { handleFystackWebhookEvent } from '@/services/custody/DepositProcessor.service';
import { verifyFystackWebhookEd25519 } from '@/services/custody/FystackWebhookVerifier';
import { logger } from '@/utils/logger';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const eventName = req.headers['x-webhook-event'];
    // #region agent log
    paymentDebugTrace({
      flow: 'webhook',
      step: 'request_received',
      data: { hasEventHeader: Boolean(eventName), sigHeaderPresent: Boolean(signature) },
    });
    // #endregion
    if (!eventName) {
      return res.status(400).json({ success: false, message: 'Missing x-webhook-event' });
    }

    const publicKeyHex = process.env.FYSTACK_WEBHOOK_PUBLIC_KEY_HEX;
    if (publicKeyHex && signature) {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const ok = verifyFystackWebhookEd25519(body, String(signature), publicKeyHex);
      // #region agent log
      paymentDebugTrace({
        flow: 'webhook',
        step: 'signature_check',
        data: { verified: ok, hadPublicKey: true },
      });
      // #endregion
      if (!ok) {
        logger.warn('Fystack webhook signature verification failed');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    } else {
      logger.warn('Fystack webhook accepted without Ed25519 verification (set FYSTACK_WEBHOOK_PUBLIC_KEY_HEX)');
      // #region agent log
      paymentDebugTrace({
        flow: 'webhook',
        step: 'signature_skipped',
        data: { hadPublicKey: Boolean(publicKeyHex), hadSigHeader: Boolean(signature) },
      });
      // #endregion
    }

    await handleFystackWebhookEvent(String(eventName), req.body || {});
    // #region agent log
    paymentDebugTrace({
      flow: 'webhook',
      step: 'handler_ok',
      data: { eventName: String(eventName) },
    });
    // #endregion
    return res.status(200).json({ received: true });
  } catch (error) {
    // #region agent log
    paymentDebugTrace({
      flow: 'webhook',
      step: 'handler_error',
      data: {
        errName: error?.name,
        errMsgLen: error?.message ? String(error.message).length : 0,
      },
    });
    // #endregion
    logger.error('Fystack webhook handler error', error);
    return res.status(500).json({ success: false, message: error?.message || 'Webhook error' });
  }
});

export default router;
