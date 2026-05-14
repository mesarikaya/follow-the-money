# Prompt: Consistency Check

Use this prompt after any significant spec change, or when you suspect drift has crept in.

---

```
Read all files in spec/, decisions/, and roadmap/.

Given the recent change: [DESCRIBE THE CHANGE]

1. Read CLAUDE.md — identify all phase/status flags affected by this change
2. Read spec/system-design.md — flag any sections now outdated or contradicted
3. Read spec/architecture.md — flag any contradictions or stale content
4. Scan decisions/adr/ — are any ADRs now superseded or in conflict with the change?
5. Scan roadmap/epics/ — does any epic's scope, dependencies, or tasks need updating?
6. Scan roadmap/milestones/ — does any milestone's acceptance criteria need updating?
7. Check CHANGELOG.md — is the change already recorded?

Output a contradiction report as a table:
| File | Section | Current claim | Conflict with | Recommended resolution |

Do NOT make any changes yet. Present the full impact list first, then ask which items to apply.
```

---

## When to use

- After accepting an ADR
- After resolving an RFC
- After a significant implementation diverges from spec
- Start of any session where you haven't worked on the project in > 1 week
- Any time you feel uncertain whether specs are consistent

## Quick version (for minor changes)

```
I just changed [X] in [file]. 
Check its `affects` frontmatter and tell me which sections in those files need updating.
Show the specific lines that need to change, then ask for confirmation before editing.
```
