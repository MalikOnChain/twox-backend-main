/**
 * GET /api/crypto/price/:currency — public, but mounted behind standardRateLimiter (100 req/min per IP).
 * Expect 429 if you exceed that from a single runner IP.
 *
 * Keep VUs low or run from many IPs for sustained load.
 */
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 3,
  duration: '30s',
}

const base = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

export default function () {
  const res = http.get(`${base}/api/crypto/price/USDT`)
  check(res, {
    '200 or 429': (r) => r.status === 200 || r.status === 429,
  })
}
