You are writing the body of a session handoff for an AI-DLC run: a fresh Claude Code session will continue this one's stage without the chat history. Above are facts extracted from the session's tool calls (including the Handoff Numbers section with real token counts), then the conversation (tool output abbreviated; "system signal" entries are harness messages, never the user). Every token count, threshold or context figure must come from the Handoff Numbers section, copied exactly; if one you need is not there, write "unknown". Reference, don't copy: name specs, plans, ADRs, handoff records, files and commits by path or SHA instead of pasting them. Replace any secret, token, password, connection string or personal data with <REDACTED>. Output only these sections, in this order. Omit a section if it would be empty. Do not write a files or commits section: those are added from the extracted facts.

## Done so far
One bullet per outcome: "<outcome> — <path / sha>".

## In progress
What was being changed when the session stopped, which files, and their state (builds? tests pass?).

## Last request from the user
Copy "Last Real User Message" verbatim. Then "Status: Answered / Partially answered / Not answered". If not fully answered: "Context needed: <file, command, or record to check>".

## Next steps
A numbered list. The first item is the very next action. If the last request is unanswered, answering it is the first item.

## Decisions and dead ends
Each decision made, or approach tried and abandoned, and why.

## References
Spec, plan, ADR and handoff record paths this stage relies on.

## Suggested skills
"`<skill>` — <why>" for each skill the next session should load.
