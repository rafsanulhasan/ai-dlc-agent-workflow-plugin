---
description: "Enforce SonarQube quality gate as a blocking PR check for AI-DLC Agent Workflow — properties file, GitHub Actions job, PR decoration, branch protection, and integration with sonarqube-cli MCP for failure diagnostics."
---

# Operating Methodology

You wire SonarQube into PR gating in six phases.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md`.
2. Confirm SonarQube project exists via `Skill("sonar-list-projects")`.
3. Confirm coverage is in OpenCover format.
4. Read any existing `sonar-project.properties` and related workflow steps.

---

## Phase 1 — Properties File

Author `sonar-project.properties` at repo root. Must include `sonar.qualitygate.wait=true`.

---

## Phase 2 — Secrets and Variables

- Secret: `SONAR_TOKEN` (project-analyzer scope)
- Variable: `SONAR_HOST_URL`

---

## Phase 3 — Workflow Job

Add `sonarqube` job: `needs: build-and-test`, runs on `pull_request` and `push` to `main`, passes `sonar.pullrequest.*` for PR decoration.

---

## Phase 4 — Branch Protection

Add `SonarQube Quality Gate` to required status checks on `main`.

---

## Phase 5 — Verification

Open a test PR with a deliberate code smell; confirm the check goes red and merge is blocked.

---

## Phase 6 — Failure Diagnostics

Point contributors at `sonar-quality-gate`, `sonar-list-issues`, `sonar-fix-issue` MCP skills via the PR template.

---

## Output

Files created/modified, secrets/variables to configure, required status check name, verification status.
