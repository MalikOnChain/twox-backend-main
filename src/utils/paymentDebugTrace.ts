import { agentDebugLog } from '@/utils/agentDebugLog';

/**
 * Structured traces for the crypto/Fystack payment stack. Enable with DEBUG_PAYMENT_TRACE=true.
 * Logs NDJSON via agentDebugLog (ingest + package-root file). No secrets or raw addresses.
 */
export function paymentDebugTrace(payload: {
  flow: string;
  step: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
}): void {
  if (process.env.DEBUG_PAYMENT_TRACE !== 'true') return;
  agentDebugLog({
    location: `payments|${payload.flow}|${payload.step}`,
    message: `${payload.flow} · ${payload.step}`,
    hypothesisId: payload.hypothesisId,
    data: { flow: payload.flow, step: payload.step, ...payload.data },
  });
}
