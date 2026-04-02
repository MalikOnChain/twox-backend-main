import { appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const AGENT_DEBUG_ENDPOINT =
  'http://127.0.0.1:7502/ingest/c1e1f37c-ef0d-433c-9219-185f5ff480a9';
const AGENT_DEBUG_SESSION = '9131d2';

/** `src/utils` -> package root (where package.json lives), stable regardless of process.cwd(). */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Debug-mode NDJSON: POST to ingest + append so logs exist when ingest does not write to the workspace. */
export function agentDebugLog(payload: {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
}): void {
  const line = JSON.stringify({
    sessionId: AGENT_DEBUG_SESSION,
    ...payload,
    timestamp: Date.now(),
  });
  fetch(AGENT_DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': AGENT_DEBUG_SESSION },
    body: line,
  }).catch(() => {});
  const paths = [
    join(PACKAGE_ROOT, 'debug-9131d2.log'),
    join(process.cwd(), 'debug-9131d2.log'),
    join(process.cwd(), '..', 'debug-9131d2.log'),
  ];
  for (const p of paths) {
    try {
      appendFileSync(p, `${line}\n`);
      break;
    } catch {
      /* try next */
    }
  }
}
