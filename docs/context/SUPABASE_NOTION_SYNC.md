# Supabase and Notion Sync

## Scope
This project uses Supabase as the PostgreSQL provider and Prisma as the ORM. Notion is treated as an operator-managed source database for profile intake, then synchronized into Supabase.

The sync is one-way:

1. Notion users database
2. Supabase `users`, `user_roles`, `user_photos`, `notion_raw_records`, and `notion_sync_records`
3. (Optional) Notion Matching History database -> Supabase `intro_cases` and `intro_case_participants`

This avoids writing contact or profile data back to Notion by default.

## Supabase setup
1. Create a Supabase project.
2. Copy the Supabase PostgreSQL connection strings into `.env.local`.
3. Use a Supabase PostgreSQL connection string for `DATABASE_URL`.
4. Link and push the Supabase migration:

```sh
npx prisma generate
supabase link --project-ref <project-ref>
supabase db push
```

Use `supabase/migrations` as the canonical database migration source. Prisma is used for ORM types and the client:

```sh
npx prisma generate
```

The first Supabase migration creates the domain tables from `03-ERD-and-Schema.md`, plus `notion_sync_records` for idempotent external sync.

## Notion setup
Create a Notion integration and share the users database with it.

Required environment variables:

```sh
NOTION_TOKEN="secret_..."
NOTION_MAIN_DATA_SOURCE_ID="..."
NOTION_INVITOR_DATA_SOURCE_ID="..."
NOTION_MATCHING_HISTORY_DATA_SOURCE_ID="..."
NOTION_API_VERSION="2025-09-03"
```

Expected Notion user properties:

| Property | Type | Required |
|---|---|---|
| `Name` | Title | Yes |
| `Status` | Select or status | No |
| `Gender` / `성별` | Select | No |
| `Roles` | Multi-select | No |
| `Birth date` | Date | No |
| `Age` / `나이` | Text | No |
| `Phone` | Phone or text | No |
| `Contact visible` | Checkbox | No |
| `Height` / `키` | Number | No |
| `Job title` / `직업` | Text | No |
| `Company name` / `회사` | Text or email | No |
| `Self intro` / `본인 소개` / `본인소개` / `자기소개` | Text | No |
| `Ideal type` / `이상형` | Text | No |
| `Photos` / `사진` / `picture` | Files | No |

Supported status values are the enum codes from the PRD, such as `READY`, and the Korean labels from the operating docs, such as `소개 가능`.

## Matching History sync (optional)
If `NOTION_MATCHING_HISTORY_DATA_SOURCE_ID` is set, `scripts/sync-notion-to-supabase.mjs` also treats that Notion data source as the source of truth for intro case history.

It will create or update:

- `intro_cases.status`
- `intro_cases.memo`
- `intro_cases.invitor_user_id` (when resolvable)
- `intro_case_participants` (two participants, A/B)

Expected Notion Matching History properties:

| Property | Type | Required |
|---|---|---|
| `Status` / `상태` | Select or status | No (defaults to `OFFERED`) |
| `Person A` / `참여자 A` | Relation or text | Yes |
| `Person B` / `참여자 B` | Relation or text | Yes |
| `Invitor` / `주선자` | Relation or text | No |
| `Memo` / `메모` / `Notes` | Rich text | No |

Notes:

- If `Person A/B` are relations to the users data source, the sync resolves the user id using `notion_sync_records`.
- If `Person A/B` are plain text, the sync resolves the user id by exact `users.name` match.

## Running sync
Dry-run first:

```sh
npm run sync:notion
```

Apply changes:

```sh
npm run sync:notion -- --write
```

Operators can also run the same write sync from the admin web UI with the `Notion -> Supabase 동기화` button in the page header. The button executes `scripts/sync-notion-to-supabase.mjs --write`, then revalidates the users and matches views.

The script stores a checksum per Notion page in `notion_sync_records`. Re-running the sync skips unchanged pages and updates rows when Notion content changes. Notion-hosted file URLs are imported as photo metadata only; binary image files are not copied into Supabase.

Manual profile photo uploads in the user detail screen use Supabase Storage bucket `user-photos` by default. The bucket name can be overridden with `SUPABASE_PHOTO_BUCKET`. Clipboard paste, file selection, and HTTPS URL metadata are supported.

## Privacy and safety notes
- Contact fields stay in Supabase only after import and are not exposed by this script.
- When `NOTION_MATCHING_HISTORY_DATA_SOURCE_ID` is enabled, the sync can create intro cases. It rejects creation if either participant already has an active intro (domain statuses like `OFFERED`, `MATCHED`, `CONNECTED`, etc.) so the rule "never create a new intro for a user in `PROGRESSING`" is still enforced.
- Uploaded files are still expected to use external object storage in production, not ephemeral local disk.
