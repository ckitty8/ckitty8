---
name: next-skill-advisor
description: End-of-session advisor that recommends which skill from the library to run next. Use when a development or evolution session is wrapping up ("on a fini", "c'est bon", "fin de session", "wrap up", "what's next", "avant de merger", "prêt à déployer") or when the user asks which skill fits the current moment.
argument-hint: "[optional: what was just done]"
---

# Next Skill Advisor

At the end of a development/evolution session, recommend the 1-3 skills from the library that are the best fit for what happens next. Recommend, never run them without the user's go.

## 1. Read the session

Gather facts, don't guess:
- `git status`, `git diff --stat`, `git log --oneline` for the session's commits (vs. the base branch).
- What the conversation was about: new feature, refactor, bug fix, infra/config, docs only.
- Signals: migrations or schema changes, new endpoints/services, touched tests (or absence of them), TODO/FIXME or workarounds added, outage or hotfix, README/docs stale.

## 2. Match to the library

| Signal in the session | Skill | Why now |
|---|---|---|
| Diff ready, branch about to be merged or PR opened | `code-review` | Catch security/perf/correctness issues before merge |
| New code with few or no tests, risky logic changed | `testing-strategy` | Decide what coverage is actually needed |
| Release, migration, feature flag, going to prod | `deploy-checklist` | Verify CI, approvals, rollback triggers |
| New service, API, data model, boundaries unclear | `system-design` | Validate the design before it hardens |
| A technology/pattern choice was made or must be made | `architecture` | Record it as an ADR with trade-offs |
| Workarounds, TODOs, duplicated code, "we'll fix later" | `tech-debt` | Prioritize what to pay back |
| Behaviour, setup or API changed; README/runbook stale | `documentation` | Keep docs in sync with the change |
| Production incident, outage, hotfix just shipped | `incident-response` | Triage, comms, blameless postmortem |

If the library holds other skills (list them from the available-skills listing), consider them too; the table is a default, not a limit.

## 3. Rank and answer

Pick at most 3, ordered by timing: what should happen before merge/deploy first, after-the-fact work (docs, debt, postmortem) last. Skip skills with no real signal; saying "nothing needed" is a valid answer.

Output format, short:

```
Session: <one line on what was done>

Recommended next
1. /<skill> — <the concrete signal that triggers it, e.g. "3 files in src/api changed, no tests added">
2. /<skill> — ...

Not needed now: <skills ruled out, one clause each>
```

Then ask which one to launch. Only invoke the chosen skill after the user confirms.

## Rules

- Ground every recommendation in something observed (a file, a commit, a stated goal). No generic advice.
- Don't recommend a skill that was already run this session unless new changes landed since.
- Keep it under ~15 lines.
