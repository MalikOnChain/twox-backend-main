/**
 * Requires JWT: same header as the app (x-auth-token).
 * Exercises auth + DB + withdraw-config path under standardRateLimiter.
 *
 *   JWT_TOKEN=eyJ... BASE_URL=http://localhost:5000 k6 run load-tests/k6/authenticated-withdraw-config.js
 */
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s',
}

const base = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
const token = __ENV.JWT_TOKEN || ''

export function setup() {
  if (!token) {
    throw new Error('Set JWT_TOKEN to a valid x-auth-token (user JWT) for this scenario.')
  }
  return { token }
}

export default function (data) {
  const res = http.get(`${base}/api/crypto/withdraw-config`, {
    headers: {
      'x-auth-token': data.token,
    },
  })
  check(res, {
    '200': (r) => r.status === 200,
    '403 means bad token': (r) => r.status === 403 || r.status === 200,
  })
}
