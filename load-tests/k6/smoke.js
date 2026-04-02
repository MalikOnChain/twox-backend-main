/**
 * Quick sanity check: API root health JSON.
 * Usage: k6 run load-tests/k6/smoke.js
 *   BASE_URL=http://localhost:5000 k6 run ...
 */
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
}

const base = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

export default function () {
  const res = http.get(`${base}/api/`)
  check(res, {
    'status 200': (r) => r.status === 200,
    operational: (r) => {
      try {
        const b = JSON.parse(r.body)
        return b.status === 'operational'
      } catch {
        return false
      }
    },
  })
}
