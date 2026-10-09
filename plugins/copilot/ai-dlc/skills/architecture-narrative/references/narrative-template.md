# <System / Initiative Name> — Architecture Narrative

> Audience: <who this is for>  ·  Author: <architect>  ·  Date: <date>  ·  Status: <draft / for review / approved>

---

## Act 1 — Setup: What business problem are we solving?

**What (context).**
<One short paragraph: the situation and the problem in business terms.>

**Why (business drivers).**
<One short paragraph: why the business is doing this now — revenue, cost, risk, regulation, growth, legacy pain.>

**Who (stakeholders & major players).**
| Stakeholder | Role / interest |
|---|---|
| <name or group> | <what they care about> |

---

## Act 2 — Confrontation: What conditions and constraints did we face?

### Constraints
| Type | Constraint | Impact on the design |
|---|---|---|
| Business | <e.g. go-live by Q2, fixed budget> | <what it rules in/out> |
| Technical | <e.g. must use existing Oracle DB, mandated cloud> | <what it rules in/out> |

### Driving architecture characteristics
| Characteristic | Why it matters (business requirement) | Target / measure |
|---|---|---|
| <scalability> | <e.g. seasonal 10× spikes in applications> | <e.g. p95 < 300 ms at peak> |

### Unique challenges
- <What makes this problem harder than usual>

### Alternatives & trade-offs
| Option | What it gives us | What it costs us | Outcome |
|---|---|---|---|
| <Option A> | <benefits> | <trade-offs> | Chosen / Rejected — <one-line reason> |
| <Option B> | | | |

---

## Act 3 — Resolution: What is the proposed solution?

### Proposed architecture
<2–3 paragraphs: the style/topology chosen and how it answers the Act 2 pressures. Reference specific constraints and characteristics by name.>

### Diagrams
1. <Context / high-level view — simplest first>
2. <Container / component view>
3. <Key flow or sequence, if needed>

### Architecture decisions (ADRs)
| ADR | Decision | Traces back to (Act 2 item) |
|---|---|---|
| ADR-001 | <decision> | <constraint / characteristic / trade-off> |

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| <risk> | <L/M/H> | <L/M/H> | <mitigation> |

---

### Arc check (delete before publishing)
- [ ] Act 1 is vision and rationale, not a requirements list
- [ ] Every Act 3 decision traces to an Act 2 item
- [ ] Every Act 2 item matters to the Act 1 problem
- [ ] Diagrams appear only in Act 3
- [ ] Risks are listed
