# AI Conventions — Follow the Money

Standing rules for every session. These are enforced, not suggested.

---

## The Golden Rule

> A fact must exist in **exactly one place**. All other references must link to it, not repeat it.

If the same claim appears in two files, that is a bug. Flag it and consolidate immediately.

---

## Where facts live (single source of truth)

| Fact type | Canonical location |
|-----------|-------------------|
| Product purpose and goals | `vision.md` |
| Hard constraints, SLAs, upgrade paths | `constraints.md` |
| Tech stack, stack choices (WHY) | `DECISIONS.md` |
| Stack details, data model, signal formulas, API contract | `spec.md` |
| Roadmap, milestones, epics, acceptance criteria | `roadmap.md` |
| Design debates and open questions | `DECISIONS.md` (RFC section) |
| Spec change history | `CHANGELOG.md` |

**No separate ADR files. No separate RFC files. No separate epic files. No separate milestone files.**

---

## Diagrams: Mermaid only

All diagrams must be Mermaid — no ASCII art, no PlantUML, no image embeds.
Full rules: `.ai/mermaid-conventions.md` — read before authoring any diagram.
Validate at https://mermaid.live before committing.

---

## Code design principles

All Java code in `ftm-app` must follow SOLID principles **and** Clean Code rules:

### SOLID

- **S — Single Responsibility**: Each class has one reason to change. Services handle business logic only; repositories handle persistence only; controllers handle HTTP translation only.
- **O — Open/Closed**: Extend behaviour through new classes or Spring event listeners, not by modifying existing ones.
- **L — Liskov Substitution**: Implementations must be substitutable for their interfaces without altering correctness. Prefer interfaces over concrete types in constructor parameters.
- **I — Interface Segregation**: Define narrow, purpose-specific interfaces. No fat interfaces that force unrelated method implementations.
- **D — Dependency Inversion**: Depend on abstractions, not concretions. Wire dependencies via constructor injection (never `@Autowired` on fields).

### Clean Code

- **Small methods**: Every method does exactly one thing. If a method needs a comment to explain what it does, extract it.
- **Meaningful names**: Classes, methods, and variables name what they are — no abbreviations, no generic names (`data`, `result`, `obj`, `temp`).
- **No dead code**: Never leave commented-out code, unused imports, or unreachable branches in committed files.
- **No magic values**: All constants must be named (`static final`) fields. No raw strings or numbers inline.
- **Fail fast**: Validate preconditions at the top of a method and return/throw early. Avoid deep nesting.
- **No mixed abstraction levels**: A method that calls business services must not also contain low-level string parsing or bit manipulation.
- **Use the type system**: Prefer records, enums, and sealed types over `String`/`Map<String,Object>` for domain concepts.
- **Jackson for JSON**: Never build JSON strings manually (`StringBuilder + "\""`). Use `ObjectMapper`.

Violations found during review must be listed as MUST-FIX, not OPTIONAL.

---

## AI must NEVER

- Repeat a decision inline without saying "see DECISIONS.md D-00X"
- Mark an RFC as resolved without updating `DECISIONS.md` and `INDEX.md` open questions table
- Author or edit a Mermaid diagram without checking `.ai/mermaid-conventions.md`
- Add a feature to an epic without checking the milestone it belongs to in `roadmap.md`
- Accept a new constraint without checking whether it contradicts an existing decision in `DECISIONS.md`
- Make an irreversible architectural decision without adding it to `DECISIONS.md` first
- Silently implement something that differs from what `spec.md` says
- Change `spec.md` or `DECISIONS.md` without appending the change to `CHANGELOG.md`
- Mark a milestone complete without verifying every acceptance criterion is checked in `roadmap.md`

---

## When a decision changes

1. Update `DECISIONS.md` first (supersede the old decision inline, add the new one)
2. Update affected sections in `spec.md`
3. Update `roadmap.md` if epic scope changes
4. Append to `CHANGELOG.md`
5. Update `last-updated` date in all modified files

Do NOT make propagations silently for significant changes — present the impact and confirm first.

---

## Decision protocol

### Architectural decision (tech choice, infrastructure, irreversible design)
1. Add a new `D-XXX` entry to `DECISIONS.md` with status: Proposed
2. If superseding an existing decision, mark the old one Superseded inline
3. Present to user for review
4. On confirmation, set status: Accepted and propagate to `spec.md`

### Feature design question (algorithm, UX, data modeling)
1. Add an RFC entry to the "Open questions" section of `DECISIONS.md`
2. List options with tradeoffs and a recommendation
3. Present open questions explicitly
4. On confirmation, move to the "Accepted decisions" section

---

## Development workflow (mandatory for all code changes)

### Branch strategy

```
main        ← production-stable; merged from develop only when milestone is verified
  └── develop   ← integration branch; all feature branches target here
        └── feat/EP-000-scaffolding
        └── feat/EP-001-ingestion
        └── feat/EP-002-schema
        └── feat/EP-00X-<kebab-epic-name>   ← one branch per epic
```

Rules:
- **One branch per epic** (`feat/EP-XXX-<kebab-title>`). Never mix epics on one branch.
- **Never commit directly to `develop` or `main`** — always go through a PR.
- **`develop` → `main`** only when all epics for a milestone are merged, tests pass, and the app runs end-to-end.
- Branch is created from `develop` at epic start; PR targets `develop` at epic end.

### Epic branch lifecycle

```
1. git checkout develop && git pull
2. git checkout -b feat/EP-XXX-<name>
3. Work: commit atomically as features complete
4. Run tests: mvn test -pl ftm-app  +  pnpm --filter ftm-frontend test
5. Independent agent review (see below)
6. Address review findings; re-run tests
7. gh pr create --base develop --title "feat(EP-XXX): <title>"
8. Merge (squash or merge commit) → develop
9. Delete the feature branch
```

### Before every PR — mandatory checklist

The AI must complete ALL of these before raising a PR. Do not skip:

- [ ] **Tests pass** — `mvn test -pl ftm-app` green (Testcontainers spin up real PostgreSQL)
- [ ] **Frontend tests pass** — `pnpm --filter ftm-frontend test` green
- [ ] **No secrets committed** — grep for API keys, passwords, `.env` files in diff
- [ ] **Spec compliance** — code matches `spec.md` (API shapes, signal formulas, data model)
- [ ] **Epic definition of done** — every checkbox in `roadmap.md` for this epic is ticked

### Independent agent review (required for every PR)

After tests pass and before raising the PR, spawn a review agent:

```
Agent(
  description: "Code review EP-XXX",
  prompt: """
  Review the git diff on branch feat/EP-XXX-<name> before merging to develop.

  Context files (read these first):
  - context/spec.md       — API shapes, data model, signal formulas must match exactly
  - context/DECISIONS.md  — architectural decisions that constrain the implementation
  - context/roadmap.md    — EP-XXX definition of done and technical tasks

  Review for:
  1. Spec compliance — does implementation match spec.md exactly? Flag any deviation.
  2. Security — command injection, SQL injection, secrets in code, CORS misconfiguration
  3. Test coverage — are happy path and key error paths covered?
  4. Code quality — SOLID violations, Clean Code violations (large methods, magic values, mixed abstraction levels, manual JSON building), missing null checks, wrong data types (BigDecimal vs Double for money)
  5. Spring conventions — @Transactional placement, @Async correctness, Caffeine cache key design
  6. Definition of done — is every task in roadmap.md EP-XXX actually implemented?

  Return: a numbered list of MUST-FIX issues and a separate list of OPTIONAL improvements.
  If there are no MUST-FIX issues, say so explicitly.
  """
)
```

The AI must address all MUST-FIX findings before raising the PR. OPTIONAL findings may be filed as follow-up tasks.

### PR format (always use this template)

```bash
gh pr create \
  --base develop \
  --title "feat(EP-XXX): <one-line description>" \
  --body "$(cat <<'EOF'
## Epic
EP-XXX — <epic title> (roadmap.md)

## What changed
- <bullet: what was built>
- <bullet: what was built>

## Definition of done
- [x] T-XXX-1: ...
- [x] T-XXX-2: ...

## Test evidence
- `mvn test -pl ftm-app` — X tests, 0 failures
- `pnpm --filter ftm-frontend test` — X tests, 0 failures

## Review
Independent agent review completed. MUST-FIX issues: none / <list if any addressed>.

🤖 Generated with Claude Code
EOF
)"
```

### Merging `develop` → `main` (milestone gates)

Only merge `develop` to `main` when:
1. All epics for the milestone are merged to `develop`
2. All milestone acceptance criteria in `roadmap.md` are checked
3. The app runs end-to-end manually (not just unit tests)
4. Update milestone status in `roadmap.md` to `✅ Done`

```bash
git checkout main
git merge --no-ff develop -m "release(M1): Data Foundation complete"
git push origin main
```

### Commit message conventions (extended)

| Type | Format | When |
|------|--------|------|
| Feature work | `feat(EP-XXX): <description>` | Code implementing an epic task |
| Bug fix | `fix(EP-XXX): <description>` | Bug found during epic development |
| Test | `test(EP-XXX): <description>` | Adding or fixing tests |
| Spec change | `spec(session-YYYY-MM-DD): <summary>` | Spec-only session |
| Decision | `spec(decision-DXX): accept <decision>` | New decision locked |
| Release | `release(MX): <milestone name> complete` | Milestone merge to main |

---

## Frontend workflow (mandatory)

### Mockup-first rule

Every new frontend page must follow this sequence — no exceptions:

1. Create an HTML mockup in `context/mockups/<page-name>.html` using the same Tailwind CDN + design tokens as existing mockups (`surface #0f172a`, `panel #1e293b`, `border #334155`, `muted #64748b`; dark mode; identical global header + sidebar structure).
2. Present the mockup to the user and get approval before writing any React/Next.js code.
3. Implement the page to match the approved mockup exactly.
4. Add at least one Playwright E2E test for the new page in `ftm-frontend/e2e/pages.spec.ts`.
5. Visually compare the implementation vs the mockup in the browser before marking the epic done.

Rationale: The HTML mockups in `context/mockups/` produced a more professional and explanatory design than direct React implementations. The mockup step catches design divergence before it is baked into code.

### Design token reference

| Token | Value | Usage |
|-------|-------|-------|
| `surface` | `#0f172a` | Page background |
| `panel` | `#1e293b` | Cards, sidebar, header |
| `border` | `#334155` | Dividers, input borders |
| `muted` | `#64748b` | Secondary text, placeholders |

All mockups use Tailwind CSS CDN with the `darkMode: 'class'` configuration and `class="dark"` on `<html>`.

---

## Session start checklist

- [ ] Read `INDEX.md`
- [ ] Check Spec Health table for stale dates
- [ ] Check open RFC decisions in `DECISIONS.md`
- [ ] Read `roadmap.md` section for today's target milestone/epic

## Session end checklist

- [ ] Update `DECISIONS.md` if any decision changed
- [ ] Update `spec.md` if any technical detail changed
- [ ] Update milestone status in `roadmap.md` if work completed
- [ ] Append to `CHANGELOG.md`
- [ ] Update `last-updated` dates in modified files
- [ ] Update Spec Health table in `INDEX.md`
- [ ] If spec-only session (no code): `git add -A && git commit -m "spec(session-YYYY-MM-DD): <summary>"`
- [ ] If code session: tests green → agent review → PR raised → remind user to merge
