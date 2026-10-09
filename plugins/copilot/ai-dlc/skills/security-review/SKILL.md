---
name: security-review
description: "Security-focused review workflow for software projects. Use for auth, data exposure, input validation, dependency risk, secrets and vulnerability checks on a change, a component, or a reported incident. Produces severity-ranked findings with remediation; P0 findings block release."
---

# Security Review

Use this skill for security-sensitive changes, P0 security work items, and incidents. It produces findings — fixes are implemented by **David Fowler** (`software-engineer`) through the BFLC lifecycle.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Phase 0 — Context

1. Read `CLAUDE.md` / `AGENTS.md` for project conventions (error/response shape, logging, auth model).
2. Identify scope: changed files (`git diff --name-only <base>...HEAD`), or the component / incident described.
3. Load memory: `Skill("manage-memory", args: "software-architect")` (or the calling agent's memory) for prior security decisions.

## Phase 1 — Map the attack surface

List every entry point the scope touches: HTTP endpoints, middleware, message consumers, background jobs, file/IO, deserialisation, outbound calls, configuration and secrets. For each, note who can reach it (anonymous, authenticated, role) and what data crosses it.

## Phase 2 — Review checklist

| Area | Check |
|---|---|
| **AuthN / AuthZ** | Every endpoint has an explicit policy; no `[AllowAnonymous]` by accident; resource-level authorisation (IDOR) checked, not only role checks |
| **Input validation** | All external input validated (type, length, range, format) at the boundary; no trust in client-supplied IDs, prices, roles |
| **Injection** | Parameterised queries only; no string-built SQL, LDAP, OS commands, or dynamic LINQ from input; safe deserialisation settings (no polymorphic type handling from untrusted input) |
| **Data exposure** | No stack traces, internal exception messages, connection strings or PII in responses or logs; DTOs do not over-expose entity fields |
| **Secrets** | No secrets in source, config files or test fixtures; secrets from a vault / user-secrets / environment; never echoed in CI logs |
| **Crypto & transport** | HTTPS enforced; no custom crypto; current algorithms; tokens validated (issuer, audience, lifetime, signature) |
| **Resilience / DoS** | Request size limits, pagination caps, timeouts, rate limiting on expensive or anonymous endpoints |
| **Dependencies** | `dotnet list package --vulnerable --include-transitive` clean, or each finding triaged |
| **Logging & audit** | Security-relevant events logged without sensitive values; correlation ids present |

Use **Jon Skeet** (`research-assistant`) for any CVE, library-version or protocol detail you are not certain of.

## Phase 3 — Report

```
## Security Review — <scope>

| # | Severity | Location (file:line) | Finding | Exploit scenario | Remediation |
|---|---|---|---|---|---|

Severity: Critical (P0, blocks release) · High · Medium · Low · Info
Dependency scan: <command + result>
Verdict: BLOCK | PASS WITH FINDINGS | PASS
```

Every Critical/High finding becomes a P0/P1 BFLC work item via **James Montemagno** (`product-manager`).
