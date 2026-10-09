---
name: k6-performance-testing
description: "Invoke this skill when the task is to validate that a system meets its SLOs under **normal operating conditions** — expected concurrency and throughput levels."
---

# k6 Performance Testing

## When to Use
Invoke this skill when the task is to validate that a system meets its SLOs under **normal operating conditions** — expected concurrency and throughput levels. This is the baseline test type. It answers: "Does the system perform acceptably at its typical production load?"

This skill covers: average-load tests, smoke tests, and baseline performance validation. It does NOT cover stress or soak scenarios (use `k6-stress-testing` or `k6-load-testing` for those).

## Prerequisites
- k6 installed: `winget install Grafana.k6` (Windows) or `brew install k6` (macOS/Linux)
- Node.js not required — k6 uses its own JS runtime
- System under test must be running and accessible

## Test Script Structure

### Mandatory Lifecycle Hooks
```javascript
// ─── INIT (runs once per VU — no HTTP allowed) ───────────────────────────────
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  // VU-based or scenario-based configuration goes here
  thresholds: { /* SLO pass/fail criteria */ },
};

// ─── SETUP (runs once before VUs start — HTTP allowed) ───────────────────────
export function setup() {
  // auth token retrieval, warm-up, etc.
  return { /* JSON-serializable data only */ };
}

// ─── VU CODE (loops per VU per iteration) ────────────────────────────────────
export default function (data) {
  // test logic here
  sleep(1); // ALWAYS include think time
}

// ─── TEARDOWN (runs once after all VUs finish) ───────────────────────────────
export function teardown(data) { /* cleanup */ }
```

### Performance Test (Average-Load Pattern)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./test-data/users.json'));
});

export const options = {
  stages: [
    { duration: '5m',  target: 50  }, // ramp-up to normal load
    { duration: '20m', target: 50  }, // hold at normal load
    { duration: '5m',  target: 0   }, // ramp-down
  ],
  thresholds: {
    http_req_duration: [
      'p(90)<400',   // 90th percentile under 400ms
      'p(95)<800',   // 95th percentile under 800ms
      'p(99)<2000',  // 99th percentile under 2s (handles .NET GC pauses)
      { threshold: 'p(99)<2000', abortOnFail: true, delayAbortEval: '30s' },
    ],
    http_req_failed: ['rate<0.01'],  // <1% error rate
    checks:          ['rate>0.99'],  // >99% checks pass
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const res = http.get(`${__ENV.BASE_URL}/api/items`, {
    headers: { Authorization: `Bearer ${user.token}` },
    tags: { endpoint: 'list-items' },
  });
  check(res, {
    'status 200':      (r) => r.status === 200,
    'response < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1 + Math.random() * 2); // 1–3s realistic think time
}
```

### Smoke Test (Script Validation)
```javascript
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};
```

## Key Metrics to Evaluate

| Metric | Type | Description | SLO Target |
|--------|------|-------------|------------|
| `http_req_duration` | Trend | Full round-trip latency (ms) | p(95) < 800ms |
| `http_req_waiting` | Trend | TTFB — server processing time | p(95) < 600ms |
| `http_req_failed` | Rate | Failed request rate | < 1% |
| `http_reqs` | Counter | Total requests / throughput | ≥ target RPS |
| `checks` | Rate | Functional assertion pass rate | > 99% |
| `iteration_duration` | Trend | Full VU iteration time | Flat over test duration |

## Defining SLOs as Thresholds

```javascript
thresholds: {
  // Latency SLOs
  'http_req_duration': [
    'p(90)<400',
    'p(95)<800',
    'p(99)<2000',
  ],
  // Per-endpoint thresholds (use tags)
  'http_req_duration{endpoint:create-item}': ['p(95)<500'],
  'http_req_duration{endpoint:list-items}':  ['p(95)<200'],
  'http_req_duration{endpoint:health}':      ['p(99)<50'],
  // Error budget
  'http_req_failed': ['rate<0.01'],
  // Functional correctness gate
  'checks': ['rate>0.99'],
}
```

**Rules**:
- Never declare the same metric key twice — use an array for multiple expressions
- Use tagged sub-metric thresholds for per-endpoint SLOs
- `abortOnFail: true` + `delayAbortEval: '30s'` for CI fast-fail gates

## CLI Usage

```bash
# Basic run
k6 run script.js

# Override from CLI
k6 run --vus 10 --duration 30s script.js

# With env vars and JSON output
k6 run --env BASE_URL=https://staging.api.example.com \
        --out json=results/k6-output.json \
        --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
        --tag test-type=performance \
        script.js
```

**Key flags**: `--vus`, `--duration`, `--iterations`, `--env`, `--out`, `--tag`, `--no-setup`, `--no-teardown`, `--discard-response-bodies`, `--http-debug`

**Exit codes**: `0` = all thresholds passed; `99` = threshold failed; `107` = test aborted.

## Parameterization with SharedArray

```javascript
import { SharedArray } from 'k6/data';

// Parsed ONCE in init context — shared read-only across all VUs
const testData = new SharedArray('test-data', function () {
  return JSON.parse(open('./test-data/payloads.json'));
});

export default function () {
  const item = testData[Math.floor(Math.random() * testData.length)];
  http.post(`${__ENV.BASE_URL}/api/items`, JSON.stringify(item), {
    headers: { 'Content-Type': 'application/json' },
  });
  sleep(1);
}
```

**Anti-patterns to avoid**:
- `JSON.parse(open('./data.json'))` inside `default()` — re-parses per iteration
- HTTP calls in init context (outside lifecycle functions)
- Non-serializable data returned from `setup()` (functions, classes, file handles)

## Tags and Groups

```javascript
// Per-request tags — enable per-endpoint threshold filtering
http.get(url, { tags: { endpoint: 'list-items', version: 'v2' } });

// Logical groups — emit group_duration metric
import { group } from 'k6';
group('create and retrieve', function () {
  http.post('/api/items', payload);
  http.get('/api/items');
});

// URL grouping to prevent high-cardinality names
http.get(http.url`/api/items/${itemId}`); // all grouped as "/api/items/${}"
```

## Output Formats

| Output | Flag | Use case |
|--------|------|----------|
| JSON (NDJSON) | `--out json=file.json` | CI artifact storage, jq analysis |
| CSV | `--out csv=file.csv` | Spreadsheet analysis |
| Grafana Cloud | `k6 cloud run script.js` | Run-over-run dashboards |
| InfluxDB | `--out influxdb=http://localhost:8086/k6` | Self-hosted dashboards |
| Prometheus | `--out experimental-prometheus-rw` | Prometheus/Grafana stack |

## Interpreting Results

```
█ THRESHOLDS
  http_req_duration
    ✓ 'p(95)<800'     p(95)=148ms    ← PASSED
    ✗ 'p(99)<2000'    p(99)=2523ms   ← FAILED → non-zero exit code

█ TOTAL RESULTS
  http_req_duration...: avg=140ms  med=138ms  p(90)=180ms  p(95)=148ms  p(99)=2523ms
  http_req_failed.....: 0.05%  ✓ 1 ✗ 1999
  http_reqs...........: 2000 66.6/s
```

- `✓` = threshold passed; `✗` = threshold failed (non-zero exit)
- Compare `avg` vs `med` — if `avg >> med`, high-latency outliers exist
- `http_reqs N/s` is actual throughput — compare against target RPS
- `http_req_duration{expected_response:true}` shows latency for 2xx/3xx only

## Sources
- https://grafana.com/docs/k6/latest/testing-guides/test-types/
- https://grafana.com/docs/k6/latest/using-k6/test-lifecycle/
- https://grafana.com/docs/k6/latest/using-k6/thresholds/
- https://grafana.com/docs/k6/latest/using-k6/metrics/reference/
- https://grafana.com/docs/k6/latest/javascript-api/k6-http/
- https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/
