---
name: k6-load-testing
description: "Invoke this skill when the task is to validate that the system sustains its SLOs at **realistic production throughput over time** — including endurance (soak) testing for memory leaks, connection pool exhaustion, and GC pressure."
---

# k6 Load Testing

## When to Use
Invoke this skill when the task is to validate that the system sustains its SLOs at **realistic production throughput over time** — including endurance (soak) testing for memory leaks, connection pool exhaustion, and GC pressure.

This skill covers:
- **Average-load tests**: validate SLOs at expected normal traffic (use for regression gates)
- **Soak / endurance tests**: validate reliability under sustained load for hours
- **Multi-scenario weighted load**: model realistic endpoint traffic mixes

For above-normal load, use `k6-stress-testing`. For basic smoke/baseline validation, use `k6-performance-testing`.

**Always run in this order**: smoke → average-load → stress → soak. Never run a soak test on a system that hasn't first passed average-load and stress.

## Executor Selection

| Executor | Model | When to Use |
|----------|-------|-------------|
| `constant-vus` | Closed | Specific concurrent user count; throughput varies with latency |
| `constant-arrival-rate` | **Open** | Fixed RPS regardless of response time. **Preferred for REST API load tests** |
| `per-vu-iterations` | Closed | Partition fixed test data across VUs (each VU processes its own slice) |

**Prefer `constant-arrival-rate`** for REST API load tests. In closed models, slow responses reduce RPS invisibly — the system appears healthy while throughput degrades.

## Constant Arrival Rate Load Test (REST API)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./test-data/users.json'));
});

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 50,                 // 50 iterations per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20,      // initial VU pool
      maxVUs: 100,              // hard ceiling
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],          // <1% error rate
    http_req_duration: [
      'p(90)<400',
      'p(95)<800',
      'p(99)<2000',
    ],
    http_req_waiting:  ['p(95)<600'],          // TTFB SLO
    checks:            ['rate>0.99'],
    dropped_iterations: ['count<10'],          // near-zero tolerance for dropped iterations
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const res = http.get(`${__ENV.BASE_URL}/api/items`, {
    headers: { Authorization: `Bearer ${user.token}` },
    tags: { endpoint: 'list-items' },
  });
  check(res, {
    'status 200':       (r) => r.status === 200,
    'response < 800ms': (r) => r.timings.duration < 800,
  });
  // Do NOT add sleep() with constant-arrival-rate — pacing is controlled by `rate`/`timeUnit`
}
```

## Soak / Endurance Test

```javascript
export const options = {
  stages: [
    { duration: '5m',  target: 100 }, // ramp-up
    { duration: '8h',  target: 100 }, // endurance plateau (adjust to 3–72h based on requirements)
    { duration: '5m',  target: 0   }, // ramp-down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: [
      'p(95)<800',
      { threshold: 'p(99)<2000', abortOnFail: true, delayAbortEval: '60s' },
    ],
  },
};
```

**Soak test minimum durations (from k6 official guidance)**:
- Minimum useful: 3–4 hours
- Standard: 8–12 hours
- Extended: 24–72 hours

**What to watch for in .NET during soak**:
- `http_req_duration` p99 trending upward continuously (memory leak / GC pressure)
- `http_req_failed` rate climbing over time (degrading reliability)
- `dropped_iterations` counter growing (open model only — indicates saturation)
- Gen 2 GC collection rate increasing (monitor via Application Insights / dotnet-counters)
- Thread pool queue length increasing (connection pool exhaustion)

## Multi-Scenario Weighted Load (Realistic Traffic Mix)

```javascript
import http from 'k6/http';

export const options = {
  scenarios: {
    // 70% of load: read endpoint at 70 RPS
    list_items: {
      executor: 'constant-arrival-rate',
      rate: 70, timeUnit: '1s', duration: '10m',
      preAllocatedVUs: 20, maxVUs: 100,
      exec: 'listItems',
      tags: { endpoint: 'list' },
    },
    // 20% of load: write endpoint at 20 RPS
    create_item: {
      executor: 'constant-arrival-rate',
      rate: 20, timeUnit: '1s', duration: '10m',
      preAllocatedVUs: 10, maxVUs: 50,
      exec: 'createItem',
      tags: { endpoint: 'create' },
    },
    // 10% of load: auth endpoint at 10 RPS
    authenticate: {
      executor: 'constant-arrival-rate',
      rate: 10, timeUnit: '1s', duration: '10m',
      preAllocatedVUs: 5, maxVUs: 20,
      exec: 'authenticate',
      tags: { endpoint: 'auth' },
    },
  },
  thresholds: {
    'http_req_duration{endpoint:list}':     ['p(95)<200'],
    'http_req_duration{endpoint:create}':   ['p(95)<500'],
    'http_req_duration{endpoint:auth}':     ['p(95)<300'],
    'http_req_failed':                       ['rate<0.01'],
  },
};

export function listItems() {
  http.get(`${__ENV.BASE_URL}/api/items`);
}

export function createItem() {
  http.post(`${__ENV.BASE_URL}/api/items`, JSON.stringify({ name: 'test' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export function authenticate() {
  http.post(`${__ENV.BASE_URL}/api/auth/token`,
    JSON.stringify({ username: 'testuser', password: 'testpass' }),
    { headers: { 'Content-Type': 'application/json' } });
}

export default function () { /* not used when scenarios define exec */ }
```

## Key Load Test Metrics

| Metric | Type | Use For |
|--------|------|---------|
| `http_reqs` | Counter | Throughput — `N/s` in summary = actual RPS |
| `http_req_duration` | Trend | Primary SLO: check p90/p95/p99 |
| `http_req_waiting` | Trend | TTFB — server-side processing time |
| `http_req_failed` | Rate | Error rate / error budget |
| `http_req_blocked` | Trend | TCP connection pool exhaustion signal |
| `data_sent` / `data_received` | Counter | Bandwidth / payload size |
| `vus_max` | Gauge | If equals `maxVUs`, executor was constrained |
| `dropped_iterations` | Counter | Non-zero = system or VU pool couldn't keep up |
| `checks` | Rate | Functional correctness under load |

**Throughput formula**: `RPS = http_reqs.count / test_duration_seconds`

## SLO Thresholds for .NET REST APIs

Starting point (adjust from production APM data):

```javascript
thresholds: {
  http_req_failed:   ['rate<0.01'],           // 99.0% success SLO
  http_req_duration: [
    'p(90)<400',    // 90th percentile
    'p(95)<800',    // 95th percentile (primary SLO)
    'p(99)<2000',   // 99th — allows for .NET GC pauses
  ],
  http_req_waiting:  ['p(95)<600'],           // TTFB guard
  checks:            ['rate>0.99'],           // functional correctness
  // Throughput floor
  'http_reqs':       ['rate>50'],             // minimum 50 RPS required
}
```

**Error budget guidance**:
- Mission-critical APIs: < 0.1% error rate
- Standard APIs: < 1% error rate
- Health endpoints: p99 < 50ms; error rate < 0.01%

## SharedArray for Large Test Data

```javascript
import { SharedArray } from 'k6/data';

// Parsed ONCE — shared read-only across all VUs (critical for large datasets)
const users = new SharedArray('test-users', function () {
  return JSON.parse(open('./users.json'));
});

// At 100k rows: SharedArray ≈ 250MB vs non-shared ≈ 9GB
export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  http.get(`${__ENV.BASE_URL}/api/profile/${user.id}`);
}
```

**SharedArray rules**:
- All processing (filtering, mapping) must happen inside the constructor callback
- Never call `.filter()` / `.map()` on a `SharedArray` outside the constructor
- Never return a `SharedArray` from `setup()` — causes marshalling, loses benefits
- Open the file inside the constructor, not at the top level

## GitHub Actions CI/CD Integration

```yaml
name: Load Tests
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # nightly regression run

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1
        with:
          k6-version: '0.56.0'   # pin for reproducibility

      - name: Run load tests
        uses: grafana/run-k6-action@v1
        with:
          path: ./tests/load/*.js
          flags: >-
            --out json=results/k6-output.json
            --env BASE_URL=${{ vars.API_BASE_URL }}
            --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)"
          fail-fast: true

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-load-test-results
          path: results/
          retention-days: 30
```

**Important**: Use `grafana/setup-k6-action@v1` + `grafana/run-k6-action@v1`. Do NOT use the archived `grafana/k6-action` (deprecated July 2024).

**Exit code behavior**: k6 exits `99` when any threshold fails → GitHub Actions step fails automatically. No extra YAML needed.

## Interpreting the End-of-Test Summary

```
█ THRESHOLDS
  http_req_duration
    ✓ 'p(95)<800'    p(95)=148ms      ← PASSED
    ✗ 'p(99)<2000'   p(99)=2523ms     ← FAILED → exit 99

█ TOTAL RESULTS
  http_req_duration...: avg=140ms  min=119ms  med=140ms  max=2523ms  p(90)=180ms  p(95)=148ms  p(99)=2523ms
  http_req_failed.....: 0.00%
  http_reqs...........: 5000 8.3/s         ← actual throughput vs target
  vus_max.............: 20   min=5   max=20 ← if near maxVUs, executor was constrained
  dropped_iterations..: 0                   ← non-zero = saturation signal
```

**Field guide**:
- `avg >> med` → high-latency outliers present; investigate p99
- `http_reqs N/s` → compare to target arrival rate; divergence = saturation
- `vus_max == maxVUs` → VU pool was constrained; increase `maxVUs` or reduce load
- `dropped_iterations > 0` → system cannot sustain target rate at `maxVUs`
- `iteration_duration gap vs http_req_duration` → the gap is think time + overhead

## Sources
- https://grafana.com/docs/k6/latest/testing-guides/test-types/load-testing/
- https://grafana.com/docs/k6/latest/testing-guides/test-types/soak-testing/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/
- https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/
- https://grafana.com/docs/k6/latest/results-output/end-of-test/
- https://github.com/grafana/setup-k6-action
- https://github.com/grafana/run-k6-action
