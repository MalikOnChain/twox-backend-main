/**
 * HTTP checks after the API is listening (used with start-server-and-test).
 * Expects the same env as a normal server start (MONGO_URI, secrets, etc.).
 */
const base = process.env.CI_API_SMOKE_BASE?.replace(/\/$/, '') || 'http://127.0.0.1:5000';

async function main() {
  const health = await fetch(`${base}/api`);
  if (!health.ok) {
    console.error(`GET /api failed: ${health.status}`);
    process.exit(1);
  }
  const stats = await fetch(`${base}/api/site/stats`);
  if (!stats.ok) {
    console.error(`GET /api/site/stats failed: ${stats.status}`);
    process.exit(1);
  }
  console.log('API smoke: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
