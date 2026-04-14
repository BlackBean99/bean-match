# Agent Prompt and Skills

## 목적
이 문서는 Blackbean Match 작업에 투입되는 에이전트가 따라야 하는 공개 가능한 프로젝트 프롬프트와 스킬 사용 기준을 정의한다. 숨겨진 시스템/개발자 프롬프트 원문은 저장소에 기록하지 않는다.

## Project Agent Prompt
아래 프롬프트를 작업 시작점으로 사용한다.

```md
You are working on Blackbean Match, a round-based, open-selection, operator-controlled private matching platform.

Before changing code, read:
1. README.md
2. docs/context/01-PRD.md
3. docs/context/02-Domain-State-FSM.md
4. docs/context/03-ERD-and-Schema.md
5. docs/context/04-API-File-Storage-and-Security.md
6. docs/context/05-Operations-Admin-Policy.md
7. docs/context/08-URL-Sharing-and-Access-Guide.md
8. docs/operations/08-Agent-Operating-Model-RPI.md
9. docs/operations/09-Git-Workflow-and-Branch-Strategy.md

Non-negotiable rules:
- Never create a new intro or round exposure for a user in PROGRESSING.
- Never expose contact information before CONNECTED.
- Only READY + FULL_OPEN users can submit round selections.
- A participant can select at most 2 candidates in one round.
- INVITOR users only drive onboarding via invite links and do not control matching or communication.
- Keep all work scoped to short-lived branches and PRs into main.
- Validate with lint, typecheck, build, and schema checks when relevant.
```

## RPI Skill
Use the RPI workflow for every non-trivial change.

- **Read**: inspect docs, current branch, status, and affected code.
- **Plan**: define scope, risk, validation, and rollback.
- **Implement**: change only the scoped files.
- **Inspect**: run validation, review diffs, push, open PR, and communicate status.

## GitHub Skill
Use for GitHub work:

- Create short-lived branches from `main`.
- Push to `origin/<branch>`.
- Open PRs targeting `main`.
- Use Squash Merge by default.
- Enable auto-merge only when repository settings allow it, checks are green, and the change is low risk.

## Domain Skill
Use for product logic:

- User states: `INCOMPLETE`, `READY`, `PROGRESSING`, `HOLD`, `STOP_REQUESTED`, `ARCHIVED`, `BLOCKED`
- Open levels: `PRIVATE`, `SEMI_OPEN`, `FULL_OPEN`
- Round states: `DRAFT`, `OPEN`, `CLOSED`, `MATCHING`, `COMPLETED`
- Intro active states include `OFFERED`, `A_INTERESTED`, `B_OFFERED`, `WAITING_RESPONSE`, `MATCHED`, `CONNECTED`, `MEETING_DONE`, `RESULT_PENDING`

## URL Sharing Skill
Use role-specific URLs:

- Participant onboarding: `/onboarding`
- Invitor-originated onboarding: `/invite/{invitorId}` or `/onboarding?invitorId={invitorId}`
- Participant round selection: `/rounds/{roundId}/participants/{userId}`
- Admin operations: `/users`, `/users/{userId}`, `/rounds`, `/matches`

Never share admin URLs with participants or invitors.

## Deployment Skill
Current repository state:

- No `vercel.json`
- No Dockerfile
- No Netlify, Railway, Render, or Fly config
- Local runtime is Next.js via `npm run dev`, `npm run build`, and `npm run start`

If an external host is used, document its project URL, branch, build command, output mode, and environment variable names here before relying on it for shared URLs.
