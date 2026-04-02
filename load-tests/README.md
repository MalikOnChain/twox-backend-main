# Load tests (k6)

These scripts stress the **BitStake / Two X** API, with emphasis on the **Fystack webhook** path (no per-IP standard rate limit) and optional authenticated crypto routes.

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/) **or** use Docker (no local install):

```bash
docker pull grafana/k6:latest
```

## Target URL

- Default: `http://localhost:5000` (override with `BASE_URL`).
- From Docker on Windows/Mac, to hit a server on the host: `BASE_URL=http://host.docker.internal:5000`.

## Run (local k6)

From repo root `backend-main/`:

```bash
# API health
k6 run load-tests/k6/smoke.js

# Webhook burst (deposit.pending — lightweight handler)
k6 run load-tests/k6/fystack-webhook-pending.js

# Mixed events (adds SPAM_CONFIRMED=true only if you want DB + unknown-address failures)
BASE_URL=http://localhost:5000 k6 run load-tests/k6/fystack-webhook-mixed.js
```

## Run (Docker)

Windows (PowerShell), from `backend-main/`:

```powershell
.\load-tests\run-docker.ps1 smoke
.\load-tests\run-docker.ps1 webhook
# Optional: custom API base
.\load-tests\run-docker.ps1 smoke -BaseUrl http://host.docker.internal:8080
```

Manual `docker run` (same image):

```powershell
docker run --rm -i -e BASE_URL=http://host.docker.internal:5000 -v "${PWD}/load-tests:/load-tests" grafana/k6:latest run /load-tests/k6/smoke.js
docker run --rm -i -e BASE_URL=http://host.docker.internal:5000 -v "${PWD}/load-tests:/load-tests" grafana/k6:latest run /load-tests/k6/fystack-webhook-pending.js
```

Linux: use `BASE_URL=http://172.17.0.1:5000` or `--network host` and `http://localhost:5000`.

## Scripts

| Script | What it hits | Notes |
|--------|----------------|-------|
| `smoke.js` | `GET /api/` | Baseline latency. |
| `fystack-webhook-pending.js` | `POST /api/webhooks/fystack` + `deposit.pending` | Best “payment ingress” throughput test; no balance credit. |
| `fystack-webhook-mixed.js` | Same route, mixed `x-webhook-event` | With `SPAM_CONFIRMED=true`, sends `deposit.confirmed` with fake addresses (Mongo + transaction work; noisy logs). |
| `crypto-public-read.js` | `GET /api/crypto/price/USDT` | **100 req/min per IP** — expect 429 if you push hard. |
| `authenticated-withdraw-config.js` | `GET /api/crypto/withdraw-config` | Set `JWT_TOKEN` (value of `x-auth-token`). Rate limited. |

## Reading results

- Watch **http_req_duration** (p95/p99) and **http_req_failed**.
- If webhooks return **401**, your server has `FYSTACK_WEBHOOK_PUBLIC_KEY_HEX` set and expects a valid `x-webhook-signature` — run against a dev env without verification, or extend the script to sign bodies (Ed25519) to match `FystackWebhookVerifier`.
- **Do not** point high `SPAM_CONFIRMED` traffic at production without coordination; it still executes real handler code and DB lookups.

## npm shortcuts

```bash
npm run loadtest:k6:smoke
npm run loadtest:k6:webhook
```

(These assume `k6` is on your `PATH`.)
