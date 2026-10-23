---
name: coherence-site
description: Read-only audit of a site/app's architecture and consistency. Maps pages, routes, menus, components, data layer and config, then checks that everything lines up (links, naming, single source of truth, code vs database vs docs). Use for "vérifie l'architecture", "est-ce cohérent", "audit de cohérence", "cartographie du site", after adding pages/features, or before a recette.
argument-hint: "[optional: folder or area to focus on]"
---

# Site Coherence Audit

Verify that the architecture of the site is coherent. **Read-only**: report findings, never modify code, data or the database. Fixes happen only after the user picks which ones to apply.

## 1. Read the project's own rules first

Read `CLAUDE.md` / `AGENTS.md` / `README` / any architecture doc (DAT, ADR, `docs/`). Every rule found there (single source for calculations, referentials in database, naming, forbidden actions) becomes an additional check in step 3, and the report quotes its source.

## 2. Map the site

Build a short inventory from the code, not from memory:
- **Entry points and routes/pages**: router config, file-based routes, `index.html` files.
- **Navigation**: menus, links, buttons that navigate.
- **UI layer**: shared components, layouts, styles/tokens.
- **Logic layer**: services, hooks, calculation helpers, API routes/serverless functions.
- **Data layer**: tables/collections, migrations, generated types, access rules (RLS or equivalent).
- **Config and deploy**: env vars, build config, hosting config (redirects, headers), lockfiles.

Output the map as a compact tree or table (max ~25 lines); it is the base for step 3.

## 3. Check consistency

| Area | What to verify |
|---|---|
| Navigation ↔ routes | Every menu entry and link leads to an existing page; no orphan page unreachable from anywhere; no duplicate route for the same screen |
| Naming | Same concept has the same name in UI, code and database; file and folder conventions respected |
| Single source of truth | Constants, lists (types, statuses, roles), calculations and formats defined once and reused, not copied |
| Layering | UI does not contain business rules or raw data access when the project separates them; shared components reused before new ones are created |
| Code ↔ database | Every table/column/function used in code exists in migrations or types; no unused table; access rules enforced in the database, not only by hiding buttons |
| Config | Env vars used in code are documented and present in the example env file; no secret in the repo |
| Docs ↔ code | README, CLAUDE.md and architecture docs describe the code as it is now (pages, commands, versions) |
| Dead weight | Unused files, components, dependencies, styles; lockfiles in sync |
| Deploy | Redirects, base URLs, canonical/sitemap entries match the real routes |
| Project rules | Each rule from step 1 |

Verify each suspicion with a search (`grep` the name, open the file) before reporting it. Do not report what you did not confirm.

## 4. Report

```
Coherence audit — <project>

Map: <2-3 lines: stack, number of pages/routes, data layer>

Findings
| # | Severity | Area | Finding | Evidence (file:line) | Suggested fix |

Consistent: <areas checked with nothing to report>
Not checked: <areas skipped and why>
```

Severity: **High** = broken (dead link, missing table, rule violated), **Medium** = divergence that will bite later (duplicated constant, stale doc), **Low** = cosmetic or cleanup.

End by asking which findings to fix. Do not fix anything unprompted.

## Rules

- Read-only: no edits, no database writes, no data changes, no network calls beyond reading.
- Every finding cites a file and line; no generic advice.
- Runtime behaviour (does the page really work in a browser) is out of scope: suggest `qa-my-app` for that.
- Keep the report under ~40 lines; group repeated findings into one row.
