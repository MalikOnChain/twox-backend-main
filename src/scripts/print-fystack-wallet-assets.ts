/**
 * Lists Fystack wallet assets for FYSTACK_HOT_WALLET_ID using only API key + secret.
 * Use the printed `asset_id` values to build FYSTACK_WITHDRAW_ASSET_MAP (no workspace ID needed for this call).
 *
 * Run: npm run fystack:print-assets (alias: fystack:refresh-assets)
 * Re-fetch after you add tokens or hit refresh in the Fystack UI. The public API has no
 * wallet-wide rescan, only POST /networks/rescan-transaction (per tx hash + network).
 */
import { Environment, FystackSDK } from '@fystack/sdk';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  const apiKey = process.env.FYSTACK_API_KEY;
  const apiSecret = process.env.FYSTACK_API_SECRET;
  const walletId = process.env.FYSTACK_HOT_WALLET_ID;

  if (!apiKey || !apiSecret || !walletId) {
    console.error(
      'Missing env: FYSTACK_API_KEY, FYSTACK_API_SECRET, and FYSTACK_HOT_WALLET_ID (see .env.example).'
    );
    process.exit(1);
  }

  const env =
    process.env.FYSTACK_ENV === 'production'
      ? Environment.Production
      : process.env.FYSTACK_ENV === 'sandbox'
        ? Environment.Sandbox
        : process.env.NODE_ENV === 'production'
          ? Environment.Production
          : Environment.Sandbox;

  const sdk = new FystackSDK({
    credentials: { apiKey, apiSecret },
    environment: env,
    domain: process.env.FYSTACK_API_DOMAIN || undefined,
    debug: process.env.FYSTACK_DEBUG === 'true',
  });

  const assets = await sdk.getWalletAssets(walletId);

  console.log(
    '\nFystack assets for hot wallet, copy each `asset_id` into FYSTACK_WITHDRAW_ASSET_MAP.\n' +
      'Keys must match withdraw rails, e.g. USDT_ERC20, USDT_TRC20, USDT_BSC, USDC_ERC20, …\n' +
      '(see resolveWithdrawAssetId in src/services/custody/CryptoWithdrawal.service.ts).\n'
  );

  for (const wa of assets) {
    const net = wa.asset?.network;
    console.log(
      JSON.stringify(
        {
          asset_id: wa.asset_id,
          symbol: wa.asset?.symbol,
          network_name: net?.name,
          network_internal_code: net?.internal_code,
          network_id: wa.asset?.network_id,
          is_native: wa.asset?.is_native,
          address_type: wa.asset?.address_type,
        },
        null,
        2
      )
    );
    console.log('');
  }

  if (assets.length === 0) {
    console.log('No assets returned. Check wallet ID and API environment (sandbox vs production).\n');
  }

  const ws = process.env.FYSTACK_WORKSPACE_ID;
  if (ws) {
    try {
      const wh = await sdk.getWebhookPublicKey(ws);
      console.log(
        'FYSTACK_WEBHOOK_PUBLIC_KEY_HEX: Fystack returns base64 in API (public_key). ' +
          'Convert to hex if your verifier expects hex, or set per FystackWebhookVerifier docs.\n' +
          `public_key (base64): ${wh.public_key}\n`
      );
    } catch (e) {
      console.warn('Could not fetch webhook key (check FYSTACK_WORKSPACE_ID):', (e as Error).message);
    }
  } else {
    console.log(
      'Tip: set FYSTACK_WORKSPACE_ID in .env and re-run to try fetching webhook verification key via API.\n' +
        'Workspace ID is not shown on the API key modal, use workspace URL (…/workspaces/<uuid>/…) or settings.\n'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
