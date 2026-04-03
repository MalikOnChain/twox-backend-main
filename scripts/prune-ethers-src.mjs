/**
 * ethers publishes declaration maps that point at src.ts; TypeScript 5.9+ then
 * typechecks that tree and fails against modern @types/node. Runtime uses lib.esm only.
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'node_modules', 'ethers', 'src.ts');
if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
