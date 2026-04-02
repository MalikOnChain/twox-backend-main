/**
 * Simulates Fystack webhook bursts for deposit.pending (handler is a no-op, no DB credit).
 * Route: POST /api/webhooks/fystack — not behind standardRateLimiter (good for throughput testing).
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 k6 run load-tests/k6/fystack-webhook-pending.js
 *
 * Heavier profile (override defaults):
 *   k6 run -e BASE_URL=http://host.docker.internal:5000 --vus 200 --duration 60s load-tests/k6/fystack-webhook-pending.js
 */
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    webhook_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 50 },
        { duration: '45s', target: 50 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
}

const base = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const payload = JSON.stringify({
  payload: {
    id: 'loadtest-pending',
    created_at: new Date().toISOString(),
  },
})

export default function () {
  const res = http.post(`${base}/api/webhooks/fystack`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-event': 'deposit.pending',
    },
  })
  check(res, {
    '200 received': (r) => r.status === 200,
    received: (r) => {
      try {
        const b = JSON.parse(r.body)
        return b.received === true
      } catch {
        return false
      }
    },
  })
}
