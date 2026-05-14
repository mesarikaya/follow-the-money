# Prompt: New Epic

Use when adding a new body of work to a milestone.

---

```
Add a new epic to roadmap.md under the relevant milestone section.

Use this structure (H3 under the milestone's H2):

### EP-XXX — [Title]

**Milestone:** MX  
**Goal:** One sentence: what outcome does this epic deliver?

**Technical tasks:**

**T-XXX-1: [Task name]** (`package.ClassName`)
Description of what to build.

**T-XXX-2: [Task name]**
...

**Definition of done:**
Specific, observable outcome. Link to the milestone acceptance criteria this epic satisfies.

---

After adding the epic:
1. Add EP-XXX to the milestone's "Epics" header in roadmap.md
2. Add EP-XXX to the epic dependency map at the bottom of roadmap.md
3. If it changes spec.md (new endpoints, data model changes), update spec.md
4. Append to CHANGELOG.md
```
