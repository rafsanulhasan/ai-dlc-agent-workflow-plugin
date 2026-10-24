---
name: feedback_tests-belong-to-sqa
description: The orchestrator must not run test suites itself; sqa-engineer runs them and the orchestrator checks that it did
metadata:
  type: feedback
---

Do not run the test suites (`node --test`, `claude plugin test`, tsc, validate runs) as the orchestrator to verify a hand-back. Testing is sqa-engineer's work: have sqa-engineer run them, and verify that it did — its hand-back quotes the real command and output, the test files it names exist, the counts are consistent with the previous hand-back, and nothing it claims is contradicted by the files.

**Why:** the human (2026-10-24): "why you are running the test cases as an orchestrator. SQ should do it and you should check whether sqa did it or not". The orchestrator only delegates and verifies claims; re-running suites duplicates sqa-engineer's work.

**How to apply:** after an agent-manager or software-engineer hand-back, route the test run to sqa-engineer (in AAW: the code path's test step) instead of running it myself. My own checks stay cheap: files exist, records and hand-backs match, `git status`, the workflow `validate`. Run a suite myself only if the human asks. Related: [[feedback_review-budget]].
