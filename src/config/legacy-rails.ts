/**
 * Legacy rails (default off = crypto-only product).
 *
 * Server env:
 * - `ENABLE_PIX_LEGACY=true`, mount PIX/IPague routes on `/transactions` (payment, withdraw, webhook, etc.).
 * - `ENABLE_VAULTODY_LEGACY=true`, init Vaultody on boot, mount `/vaultody`, allow Vaultody deposit fallback in signup.
 *
 * Player frontend (optional, must be public):
 * - `NEXT_PUBLIC_ENABLE_PIX_LEGACY=true`, show `ModalType.Pix` cashier.
 * - `NEXT_PUBLIC_ENABLE_VAULTODY_LEGACY=true`, show Vaultody filter in balance modal.
 */

/**
 * Legacy Brazil PIX / IPague HTTP surface (`/transactions/payment`, `/withdraw`, webhooks, etc.).
 */
export function isPixLegacyEnabled(): boolean {
  return process.env.ENABLE_PIX_LEGACY === 'true';
}

/**
 * Vaultody API on boot + `/vaultody` routes + provisioning fallback when Fystack is not used.
 */
export function isVaultodyLegacyEnabled(): boolean {
  return process.env.ENABLE_VAULTODY_LEGACY === 'true';
}
