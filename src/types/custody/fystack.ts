/** Fystack webhook event names (cloud SaaS). */
export const FYSTACK_WEBHOOK_EVENTS = {
  DEPOSIT_PENDING: 'deposit.pending',
  DEPOSIT_CONFIRMED: 'deposit.confirmed',
  WITHDRAWAL_PENDING: 'withdrawal.pending',
  WITHDRAWAL_EXECUTED: 'withdrawal.executed',
  WITHDRAWAL_CONFIRMED: 'withdrawal.confirmed',
  WITHDRAWAL_FAILED: 'withdrawal.failed',
} as const;

export type FystackWebhookEvent = (typeof FYSTACK_WEBHOOK_EVENTS)[keyof typeof FYSTACK_WEBHOOK_EVENTS];

/** Normalized inbound transfer after parsing Fystack deposit payload. */
export interface InboundDepositTransfer {
  providerTxId: string;
  txHash: string | null;
  toAddress: string;
  amountHuman: number;
  unit: string;
  assetId?: string;
  rawPayload: Record<string, unknown>;
}
