---
name: k6-docker
description: "Invoke this skill when the question is **how to run k6 tests via Docker** — for either local development or CI automation. This skill is the execution-infrastructure complement to the k6 scripting skills"
---

# k6 Docker Execution

## When to Use
Invoke this skill when the question is **how to run k6 tests via Docker** — for either local development or CI automation. This skill is the execution-infrastructure complement to the k6 scripting skills:

- Use `k6-performance-testing`, `k6-stress-testing`, `k6-load-testing` to write the test scripts and configure thresholds.
- Use **this skill** to decide how to execute those scripts via Docker.

Trigger scenarios:
- "How do I run my k6 script without installing k6 natively?"
- "How do I run k6 in Docker Compose with InfluxDB + Grafana dashboards?"
- "How do I run k6 from an AI agent session (Bash tool)?"
- "How do I set up CI with Docker-based k6?"
- "How do I run k6 programmatically from a .NET Testcontainers fixture?"

## Official Docker Image

```bash
docker pull grafana/k6           # latest stable (recommended for CI — pin the tag)
docker pull grafana/k6:0.56.0    # pinned version (reproducible builds)
docker pull grafana/k6:latest-with-browser  # includes Chromium for k6 Browser API
```

Image: `grafana/k6` on Docker Hub (Verified Publisher). Alpine-based, non-root user (UID 12345).

## Dev-Time: Running k6 in Docker Locally

### Pattern A — stdin pipe (zero setup, fastest for quick runs)

```bash
# Linux / macOS
docker run --rm -i grafana/k6 run - < script.js

# Windows (PowerShell)
cat script.js | docker run --rm -i grafana/k6 run -

# With VUs, duration, and env vars
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:5000 \
  grafana/k6 run --vus 10 --duration 30s - < script.js
```

### Pattern B — volume mount (for multi-file projects with test data)

```bash
# Linux / macOS
docker run --rm -i \
  -v "$PWD":/scripts \
  -w /scripts \
  grafana/k6 run script.js

# Windows (PowerShell)
docker run --rm -i `
  -v "${PWD}:/scripts" `
  -w /scripts `
  grafana/k6 run script.js
```

### Reaching the Host's ASP.NET Core API from the Container

The k6 container cannot reach `localhost` on the host directly — use these patterns:

| Platform | Hostname | Extra Docker Flag |
|----------|----------|-------------------|
| Docker Desktop (Windows / macOS) | `host.docker.internal` | None — resolved automatically |
| Docker Engine on Linux | `host.docker.internal` | `--add-host=host.docker.internal:host-gateway` |
| Docker Engine on Linux (alt) | `172.17.0.1` | None (default bridge gateway IP) |

```bash
# Linux Docker Engine
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -e BASE_URL=http://host.docker.internal:5000 \
  grafana/k6 run - < script.js
```

In the k6 script:
```javascript
const res = http.get(`${__ENV.BASE_URL}/api/health`);
```

## Dev-Time: AI Agent Session (Bash Tool)

**Docker MCP cannot spawn arbitrary containers.** The MCP Gateway only manages MCP server lifecycle (mcp-find, mcp-add, mcp-remove). There is no `container-run` or `docker-exec` primordial tool. The `poci`-type docker tool in mcp-registry is unconfirmed/experimental.

**Use the `Bash` tool instead** — both Claude Code and GitHub Copilot run in the host environment with full Docker daemon access:

```bash
# Run k6 and capture summary output (synchronous — blocks until k6 exits)
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -v "$PWD/tests/load":/scripts \
  -e BASE_URL=http://host.docker.internal:5000 \
  grafana/k6 run /scripts/load-test.js
# k6 text summary prints to stdout — agent reads it directly
```

**Parsing results from the agent**: k6 prints pass/fail thresholds as `✓` / `✗` in stdout. The agent can detect threshold results from the text summary without any JSON parsing. For structured parsing, use `handleSummary()`:

```javascript
export function handleSummary(data) {
  return { 'stdout': JSON.stringify(data) }; // agent receives structured JSON
}
```

**Exit code interpretation**:
- `0` — all thresholds passed → performance is acceptable
- `99` — threshold breached → report SLO violation to the user
- `107` — script error → fix the test script

## Dev-Time: Local Observability Stack (Docker Compose + InfluxDB v1 + Grafana)

Use the built-in InfluxDB v1 output (no custom k6 build required):

```yaml
# docker-compose.observability.yml
version: '3.4'

networks:
  grafana:

services:
  influxdb:
    image: influxdb:1.12
    networks: [grafana]
    ports: ["8086:8086"]
    environment:
      - INFLUXDB_DB=k6

  grafana:
    image: grafana/grafana:9.5.21
    networks: [grafana]
    ports: ["3000:3000"]
    environment:
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_BASIC_ENABLED=false
    volumes:
      - ./grafana:/etc/grafana/provisioning/  # auto-provisions datasource + dashboard

  k6:
    image: grafana/k6
    networks: [grafana]
    volumes:
      - ./tests/load:/scripts
```

**Run a test and stream to InfluxDB**:
```bash
docker compose -f docker-compose.observability.yml run --rm -T k6 run \
  --out influxdb=http://influxdb:8086/k6 \
  /scripts/load-test.js
```

**Open the dashboard**: `http://localhost:3000/d/Le2Ku9NMk/k6-performance-test`

Alternatively import Grafana community dashboard **ID 2587** ("k6 Load Testing Results") via Grafana → Dashboards → Import → ID `2587`.

### Advanced: InfluxDB v2 + Grafana (requires custom k6 build)

InfluxDB v2 output is NOT in the stock `grafana/k6` image. Use the official `grafana/xk6-output-influxdb` repo (includes a `Dockerfile` and `docker-compose.yml` with pre-provisioned dashboards):

```
https://github.com/grafana/xk6-output-influxdb
```

## Dev-Time: Programmatic k6 from .NET (Testcontainers)

**There is no official `Testcontainers.K6` NuGet package** (confirmed: zero results on NuGet, May 2026). Use the generic `ContainerBuilder` API:

```csharp
// NuGet: Testcontainers (v3.x)
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

IContainer k6 = new ContainerBuilder()
    .WithImage("grafana/k6:latest")
    .WithResourceMapping(
        source: FilePath.Of("tests/load/script.js"),   // copy from host into container
        target: "/scripts/script.js")
    .WithEnvironment("BASE_URL", "http://host.docker.internal:5000")
    .WithOutputConsumer(Consume.RedirectStdoutAndStderrToConsole())
    .WithWaitStrategy(Wait.ForUnixContainer().UntilContainerIsGone())
    .WithCommand("run", "/scripts/script.js")
    .Build();

await k6.StartAsync();          // blocks until k6 exits
int exitCode = await k6.GetExitCodeAsync();
await k6.DisposeAsync();

// exitCode 0 = pass; 99 = threshold fail
Assert.That(exitCode, Is.EqualTo(0));
```

**Key rules**:
- Use `WithResourceMapping` (not `WithBindMount`) — it is portable across host and CI environments.
- `WithOutputConsumer(Consume.RedirectStdoutAndStderrToConsole())` streams k6 output in real time.
- On Linux, pass `--add-host=host.docker.internal:host-gateway` via `.WithCreateParameterModifier(...)`.

## CI: GitHub Actions — Native k6 (Recommended)

Use `grafana/setup-k6-action@v1` + `grafana/run-k6-action@v1`. **Do NOT use the archived `grafana/k6-action`** (deprecated July 2024).

```yaml
name: k6 Performance Tests

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 2 * * *'

jobs:
  k6-tests:
    strategy:
      matrix:
        test-type: [smoke, load, stress]
      fail-fast: false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1
        with:
          k6-version: '0.56.0'  # pin for reproducibility

      - name: Run k6 (${{ matrix.test-type }})
        uses: grafana/run-k6-action@v1
        with:
          path: ./tests/load/${{ matrix.test-type }}-test.js
          flags: >-
            --out json=results/k6-output.json
            --env BASE_URL=${{ vars.API_BASE_URL }}
            --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)"
          fail-fast: true

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-results-${{ matrix.test-type }}
          path: results/
          retention-days: 30
```

## CI: GitHub Actions — Docker-Based k6

Use when you need a hermetic environment, custom xk6 extensions, or Docker Compose stack testing:

```yaml
jobs:
  k6-docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create results dir
        run: mkdir -p results

      - name: Run k6 in Docker
        run: |
          docker run --rm \
            -v "$GITHUB_WORKSPACE":/workspace \
            -w /workspace \
            -e BASE_URL="${{ vars.API_BASE_URL }}" \
            -e API_KEY="${{ secrets.API_KEY }}" \
            grafana/k6:0.56.0 run \
              --out json=results/k6-output.json \
              tests/load/load-test.js
        # Exit code 99 (threshold fail) auto-fails the step

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-docker-results
          path: results/
          retention-days: 30
```

**Exit code 99 automatically fails the GitHub Actions step** — no extra configuration needed.

## CI: Docker Compose Full-Stack (app + k6 + InfluxDB)

```yaml
# docker-compose.perf.yml
version: '3.4'
networks:
  perf:

services:
  dotnet-api:
    build: .
    networks: [perf]
    ports: ["8080:8080"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/healthz || exit 1"]
      interval: 10s
      retries: 5
      start_period: 30s
      timeout: 5s

  influxdb:
    image: influxdb:1.12
    networks: [perf]
    environment: [INFLUXDB_DB=k6]

  k6:
    image: grafana/k6:latest
    networks: [perf]
    volumes: ["./tests/load:/scripts"]
    command: run --out influxdb=http://influxdb:8086/k6 /scripts/load-test.js
    depends_on:
      dotnet-api:
        condition: service_healthy  # k6 waits for API healthcheck to pass
```

**GitHub Actions step:**
```yaml
- name: Run full-stack load test
  run: |
    docker compose -f docker-compose.perf.yml up \
      --abort-on-container-exit \
      --exit-code-from k6 \
      --build
```

`--exit-code-from k6` forwards k6's exit code (99 on threshold failure) to the step.

**ASP.NET Core healthcheck endpoint** (maps to `/healthz`):
```csharp
builder.Services.AddHealthChecks();
app.MapHealthChecks("/healthz");
```

## Recommended CLI Flags for CI Load Tests

| Flag | When to use |
|------|-------------|
| `--discard-response-bodies` | **Always in CI** — reduces k6 container memory significantly and lowers GC pressure, producing more accurate latency measurements. Override per-request with `responseType: 'text'` where body is needed. |
| `--no-connection-reuse` | Only when testing connection establishment overhead; do NOT use as default — distorts production-representative latency |
| `--out json=/output/raw.json` | When you need per-data-point time-series (InfluxDB, trend analysis). Expensive for long tests — compress with `.gz` extension |
| `--summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)"` | Always — ensures CI artifacts contain all SLO-relevant percentiles |

## Exit Code Reference

| Code | Meaning | CI Action |
|------|---------|-----------|
| `0` | All thresholds passed | ✅ Pass |
| `99` | **Threshold(s) failed** | ❌ Fail — SLO breach |
| `100` | `setup()` timed out | ❌ Fail — infrastructure issue |
| `101` | `teardown()` timed out | ❌ Fail — infrastructure issue |
| `104` | Invalid config | ❌ Fail — fix script options |
| `105` | SIGINT/SIGTERM (user cancel) | ⚠️ Skip — not a test failure |
| `107` | Script JS exception | ❌ Fail — fix the test script |
| `108` | `test.abort()` called | ❌ Fail — controlled abort |

## handleSummary() + Volume Mount (structured CI output)

```javascript
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: false }),
    '/output/summary.json': JSON.stringify(data),   // → CI artifact via volume mount
  };
}
```

Mount the output directory:
```bash
docker run --rm -i \
  -v "$PWD/results":/output \
  -v "$PWD/scripts":/scripts \
  grafana/k6 run /scripts/load-test.js
```

`if: always()` on artifact upload ensures results are saved even on threshold failure (exit 99).

## Distributed Execution: `--execution-segment`

For tests exceeding a single machine's capacity, split VUs/iterations across multiple containers:

```bash
# 4 parallel Docker containers sharing the full VU space
docker run grafana/k6 run \
  --execution-segment "0:1/4" \
  --execution-segment-sequence "0,1/4,2/4,3/4,1" \
  /scripts/load.js
# (and 3 more containers with segments 1/4:2/4, 2/4:3/4, 3/4:1)
```

**Note**: Each container produces independent metrics. Aggregate via shared InfluxDB/Prometheus — there is no automatic aggregation across containers. For Kubernetes-native distributed execution with aggregation, use the k6 Operator (`grafana/k6-operator`).

## Secrets Handling

```yaml
# GitHub Actions — pass secrets as Docker env vars (masked in logs automatically)
- name: Run k6
  run: |
    docker run --rm -i \
      -e API_KEY="${{ secrets.API_KEY }}" \
      -e BASE_URL="${{ vars.API_BASE_URL }}" \
      grafana/k6 run - < tests/load/load-test.js
```

**Never embed secrets in** `docker-compose.yml`, CLI command strings logged to stdout, or k6 script files. Use `-e KEY=VALUE` with GitHub Actions secrets — they are masked from CI logs.

For local dev, use a `.env` file (gitignored) with `docker run --env-file .env grafana/k6 ...`.

## Sources
- https://grafana.com/docs/k6/latest/get-started/running-k6/ — Official k6 Docker patterns
- https://hub.docker.com/r/grafana/k6 — Docker Hub verified publisher image
- https://github.com/grafana/xk6-output-influxdb — Official InfluxDB v2 compose stack
- https://github.com/grafana/run-k6-action — run-k6-action v1 source
- https://github.com/grafana/setup-k6-action — setup-k6-action v1 source
- https://docs.docker.com/ai/mcp-catalog-and-toolkit/ — Docker MCP toolkit (confirms no container-run tool)
- https://testcontainers.com/modules/k6/ — Testcontainers K6 module (Java/Go only; no .NET)
- https://github.com/grafana/k6/blob/master/errext/exitcodes/codes.go — Exit code constants
