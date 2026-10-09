---
name: k6-stress-testing
description: "Invoke this skill when the task is to validate system behaviour **beyond normal capacity** — to observe how it degrades and whether it recovers. This skill answers: 'What happens when load exceeds the normal operating point?'"
---

# k6 Stress Testing

## When to Use
Invoke this skill when the task is to validate system behaviour **beyond normal capacity** — to observe how it degrades and whether it recovers. This skill answers: "What happens when load exceeds the normal operating point?"

Use after `k6-performance-testing` (average-load) establishes a baseline. Covers: stress tests, spike tests, and breaking-point (breakpoint) tests.

## Test Types Covered

| Type | Target VU/Rate | Duration | Goal |
|------|---------------|----------|------|
| **Stress** | ≥ 120–200% of normal | 45–60 min | Observe degradation and recovery behaviour |
| **Spike** | Extreme burst (2000+ VUs), no plateau | 3–5 min | Validate sudden traffic surge handling |
| **Breakpoint** | Continuously ramping until failure | Until abort | Find the system capacity ceiling |

## Executor Choice: Open vs Closed Model

**Always use `ramping-arrival-rate` (open model) for stress and breakpoint tests.**

| Model | Executors | Behaviour under stress |
|-------|-----------|----------------------|
| **Closed** | `ramping-vus`, `constant-vus` | Iteration rate drops as system slows → masks true failure rate (coordinated omission) |
| **Open** | `ramping-arrival-rate`, `constant-arrival-rate` | Iteration starts are decoupled from completion → accurately reflects real-world arrival pressure |

With VU-based executors, as the system slows down, fewer iterations complete per second — the load generator backs off invisibly. The system appears healthy while it is actually overloaded.

## Stress Test Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const appErrorRate = new Rate('app_errors');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,       // allocate generously — avoids spawn latency
      maxVUs: 500,
      stages: [
        { duration: '2m',  target: 10  }, // warm-up at baseline
        { duration: '10m', target: 100 }, // ramp to stress level (100 req/s)
        { duration: '20m', target: 100 }, // hold at stress load
        { duration: '5m',  target: 10  }, // ramp down — observe recovery
      ],
      tags: { phase: 'stress' },
    },
    spike: {
      executor: 'ramping-arrival-rate',
      startTime: '37m',            // starts after stress phase completes
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 800,
      stages: [
        { duration: '30s', target: 10  }, // brief baseline
        { duration: '2m',  target: 500 }, // sudden spike to 500 req/s
        { duration: '30s', target: 10  }, // quick return to baseline
      ],
      tags: { phase: 'spike' },
    },
  },
  thresholds: {
    // Degraded SLO — test FAILS at end but does not abort
    'http_req_duration{phase:stress}': ['p(95)<800'],
    'http_req_duration{phase:spike}':  ['p(95)<1500'], // looser during spike

    // Broken threshold — abort test if error rate exceeds 5%
    http_req_failed: [{
      threshold: 'rate<0.05',
      abortOnFail: true,
      delayAbortEval: '30s',  // ignore transient spikes during ramp-up
    }],

    // Application-level error guard
    app_errors: [{
      threshold: 'rate<0.05',
      abortOnFail: true,
      delayAbortEval: '30s',
    }],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/health`, { timeout: '10s' });

  const ok = check(res, {
    'status is 200':       (r) => r.status === 200,
    'response time < 2s':  (r) => r.timings.duration < 2000,
    'no error in body':    (r) => !r.body.includes('error'),
  });

  if (!ok) {
    appErrorRate.add(1);
    return; // skip dependent steps gracefully
  }

  appErrorRate.add(0);
  sleep(1); // ALWAYS include think time
}
```

## Breakpoint Test Script

```javascript
export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 5000,
      stages: [
        { duration: '2h', target: 20000 }, // ramp until the system breaks
      ],
    },
  },
  thresholds: {
    http_req_failed: [{
      threshold: 'rate<0.05',
      abortOnFail: true,
      delayAbortEval: '60s',  // longer delay for gradual ramp
    }],
    http_req_duration: [{
      threshold: 'p(99)<5000',
      abortOnFail: true,
      delayAbortEval: '60s',
    }],
  },
};
```

## Stage Configuration Reference

**Standard stress stages (ramp-up → hold → ramp-down)**:
```javascript
stages: [
  { duration: '10m', target: 200 }, // ramp from 0 to 200 over 10 minutes
  { duration: '30m', target: 200 }, // hold at peak stress load
  { duration: '5m',  target: 0   }, // ramp down
],
```

**Zero-duration stage for instantaneous spike**:
```javascript
stages: [
  { target: 200, duration: '30s' }, // gradual ramp to 200 req/s
  { target: 500, duration: '0'   }, // instant jump to 500 req/s
  { target: 500, duration: '10m' }, // hold
],
```

## Detecting the Breaking Point

Watch for these signals in k6 output and logs:

| Signal | Metric | Breaking-Point Indicator |
|--------|--------|--------------------------|
| Error rate cliff | `http_req_failed` | Jumps from < 0.5% to > 5–10% in a short window |
| Latency cliff | `http_req_duration` p(95)/p(99) | Doubles or triples non-linearly from baseline |
| Queue buildup | `http_req_waiting` | Rising steadily → sudden jump (queue overflow) |
| Connection exhaustion | `http_req_blocked` | Rising rapidly — TCP connection pool exhausted |
| VU starvation | `dropped_iterations` | Non-zero counter (arrival-rate: pool exhausted) |
| Connection reset | k6 log output | `connection reset by peer` / `i/o timeout` errors |

## Threshold Patterns for Stress

```javascript
thresholds: {
  // Degraded — warn at test end, do not abort
  http_req_duration: ['p(95)<500'],

  // Broken — abort immediately (with delay for transient spikes)
  http_req_failed: [{
    threshold: 'rate<0.05',
    abortOnFail: true,
    delayAbortEval: '30s',
  }],

  // Extreme latency guard
  http_req_duration: [{
    threshold: 'p(99)<2000',
    abortOnFail: true,
    delayAbortEval: '30s',
  }],
}
```

**Note**: You cannot declare the same metric key twice — use an array for multiple expressions.

## `ramping-arrival-rate` Parameter Reference

```javascript
{
  executor: 'ramping-arrival-rate',
  startRate: 300,         // iterations per timeUnit at test start
  timeUnit: '1m',         // default '1s'
  preAllocatedVUs: 50,    // VUs allocated before test starts (avoids spawn latency)
  maxVUs: 200,            // optional cap on spawned VUs
  stages: [
    { target: 300, duration: '1m' },
    { target: 600, duration: '2m' },
    { target: 60,  duration: '2m' },
  ],
}
```

**Critical**: `preAllocatedVUs` must be large enough that k6 does not spawn VUs mid-test. Monitor `dropped_iterations` — a non-zero counter means the system is saturated.

## CLI Usage

```bash
# Run with env var
k6 run --env BASE_URL=https://staging.api.example.com stress.js

# Tag the test run for analysis
k6 run --tag test-type=stress --tag env=staging stress.js

# Pass stage config via CLI (useful for CI parameterization)
k6 run --stage 5s:10,5m:200,10s:5 script.js
# or
K6_STAGES="10m:200,30m:200,5m:0" k6 run script.js

# Exploratory run (skip threshold evaluation)
k6 run --no-thresholds stress.js

# Export raw metrics for post-analysis
k6 run --out json=results/stress-output.json stress.js
```

## Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|--------------|---------|-----|
| **No `sleep()` in VU body** | VU runs at full CPU speed; load is unrealistic and overloads k6 host | Add `sleep(1)` or `sleep(Math.random() * 3 + 1)` |
| **Using `ramping-vus` for breakpoint** | Closed model backs off as system slows — masks the true failure rate | Use `ramping-arrival-rate` |
| **`preAllocatedVUs` too small** | Dynamic VU spawn mid-test or silently dropped iterations | Size to handle peak iteration rate; monitor `dropped_iterations` |
| **No `abortOnFail` on breakpoint** | Test runs for hours past the breaking point | Set `abortOnFail: true` + `delayAbortEval: '60s'` |
| **`abortOnFail` with no `delayAbortEval`** | Transient cold-start errors abort the test prematurely | Always set `delayAbortEval` to ≥ 20s for stress, ≥ 60s for breakpoint |
| **Confusing VU count with RPS** | With `sleep(1)`, 100 VUs ≈ 100 RPS; without, 100 VUs >> 100 RPS | Use `ramping-arrival-rate` with explicit `rate` for precise RPS control |
| **Not setting `gracefulRampDown`** | VUs killed during ramp-down produce spurious `interrupted` errors | Set `gracefulRampDown: '30s'` (default) or higher |
| **Running from a single weak machine** | k6 host becomes the bottleneck before the SUT | Use `--execution-segment` for distributed testing or Grafana Cloud k6 |

## Sources
- https://grafana.com/docs/k6/latest/testing-guides/test-types/stress-testing/
- https://grafana.com/docs/k6/latest/testing-guides/test-types/spike-testing/
- https://grafana.com/docs/k6/latest/testing-guides/test-types/breakpoint-testing/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/
- https://grafana.com/docs/k6/latest/using-k6/thresholds/
