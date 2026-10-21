---
name: policy-skill-single-source
description: A cross-stack testing/coding policy lives in one language-agnostic skill; stack skills and templates keep only mechanics plus a one-line pointer
metadata:
  type: feedback
---

When a rule is scattered across stack skills (C#, JS/TS, Playwright templates), consolidate it into one language-agnostic policy skill (e.g. `test-doubles`) and replace every copy with a one-line pointer. Never copy the policy back into stack skills; they keep only mechanics, with a stack-pointer table in the policy skill pointing at them.

**Why:** User decision 2026-10-10 (test-doubles skill, branch feat/js-ts-stack): "keep one source of truth; replace duplicated policy wording with a short pointer; never copy the policy."

**How to apply:** For any new policy, grep all skills, templates, references and agent `## Skills` trigger lines for paraphrases (e.g. "no mocks", "system boundaries") and rewrite each to point at the policy skill. Examples in templates must themselves obey the policy. Related: [[skill-mapping-in-body]].
