# AGENTS.md

## Mission
Build and operate the intro platform according to the repository docs.

## Must Read First
1. README.md
2. docs/context/01-PRD.md
3. docs/context/02-Domain-State-FSM.md
4. docs/context/03-ERD-and-Schema.md
5. docs/context/04-API-File-Storage-and-Security.md
6. docs/context/05-Operations-Admin-Policy.md
7. docs/context/06-design-style-generic-guide.md
8. docs/context/07-Technical-Specification.md
9. docs/operations/08-Agent-Operating-Model-RPI.md
10. docs/operations/09-Git-Workflow-and-Branch-Strategy.md
11. docs/operations/10-Commit-PR-Merge-Policy.md
12. docs/operations/11-Code-Complete-and-Definition-of-Done.md
13. docs/operations/12-Agent-Autonomy-Runbook.md
14. docs/operations/14-Multi-Agent-Orchestration-Model.md
15. docs/operations/15-Agent-Task-Contract.md
16. docs/operations/16-Agent-Team-Usage-Guide.md

## Non-Negotiable Rules
- Never create a new intro for a user in `PROGRESSING`.
- Never expose contact info before `CONNECTED`.
- Never store uploaded files on ephemeral local disk in production.
- Treat privacy, security, and consent changes as high-risk.
- Keep PRs small and scoped.
- Update docs if domain, API, schema, or operations change.
- Default every development request to a short-lived branch and PR, even for small fixes.
- All development changes must land through a PR; do not treat direct mainline edits as complete work.
- When the owner has explicitly asked for a change, proceed with routine git push and environment/config edits without additional yes/no prompts unless a higher-level approval gate applies.
- Treat each new deployment boundary as a new PR unit instead of appending unrelated deployment fixes to an already-open PR.

## RPI Workflow
1. Read the relevant docs
2. Plan the change
3. Implement in a scoped branch
4. Validate with lint/typecheck/test/build
5. Commit with conventional commits
6. Open PR with summary, impact, validation, and rollback
7. Merge only through the repository's approved PR path

## Multi-Agent Governance
- Human Owner is the final approver.
- Principal Engineer Agent owns planning, delegation, conflict resolution, and final integration.
- Specialist agents work only through task cards with explicit inputs, constraints, outputs, and approval gates.
- Specialist agents do not peer-delegate to one another by default.

## Approval Gates
Human approval is required for:
- DB schema changes
- migration files
- auth/session/token changes
- personal data exposure policy changes
- infrastructure or deployment changes
- data deletion or destructive scripts

## Auto Merge Rules
Allowed only if:
- CI is green
- change is low-risk
- no privacy/security/legal labels
- branch protection rules pass
