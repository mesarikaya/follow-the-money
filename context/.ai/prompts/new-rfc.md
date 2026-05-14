# Prompt: New Open Question (RFC)

Use when a design choice requires analysis before deciding.

---

```
Add a new open question to the "Open questions (RFCs)" section of DECISIONS.md.

Structure:

### RFC-00X — [Title]

**Status:** Draft · **Target:** Needed before [milestone]

**Proposed approach:**
[Describe the recommended option with rationale]

**Alternatives considered:**
| Option | Why not preferred |
|--------|------------------|
| ...    | ...              |

**Open questions:**
1. [Question that needs user input]
2. ...

**Action needed:** [What decision is required and when]

---

After drafting, present open questions to user.
On resolution, move content to "Accepted decisions" as D-XXX.
Update spec.md if it affects stack/data model/API. Append to CHANGELOG.md.
```
