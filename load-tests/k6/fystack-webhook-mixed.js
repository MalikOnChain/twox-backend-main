/**
 * Mix of lightweight webhook events: deposit.pending, ignored events, deposit.confirmed-shaped
 * payloads that fail fast (unknown address) — use SPAM_CONFIRMED=true only if you intend to hammer Mongo.
 *
 * Default: mostly pending + ignored (no DB writes on pending/ignored).
 */
import http from 'k6/http'
import { check } from 'k6'

const spamConfirmed = __ENV.SPAM_CONFIRMED === 'true'

export const options = {
  vus: Number(__ENV.VUS || 30),
  duration: __ENV.DURATION || '45s',
  thresholds: {
    http_req_failed: ['rate<0.1'],
  },
}

const base = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const events = spamConfirmed
  ? ['deposit.confirmed']
  : ['deposit.pending', 'deposit.pending', 'wallet.unknown', 'deposit.pending']

export default function () {
  const eventName = events[Math.floor(Math.random() * events.length)]
  const body =
    eventName === 'deposit.confirmed'
      ? JSON.stringify({
          payload: {
            id: `lt-${__VU}-${__ITER}-${Date.now()}`,
            to_address: '0x0000000000000000000000000000000000000001',
            amount: '1000000',
            asset: { symbol: 'USDT', decimals: 6 },
            tx_hash: `0xload${__VU}${__ITER}${Date.now()}`,
          },
        })
      : JSON.stringify({ payload: { id: `noop-${__VU}-${__ITER}` } })

  const res = http.post(`${base}/api/webhooks/fystack`, body, {
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-event': eventName,
    },
  })

  if (eventName === 'deposit.confirmed') {
    check(res, {
      'confirmed handled (200 or 500)': (r) => r.status === 200 || r.status === 500,
    })
  } else {
    check(res, {
      '2xx': (r) => r.status >= 200 && r.status < 300,
    })
  }
}
