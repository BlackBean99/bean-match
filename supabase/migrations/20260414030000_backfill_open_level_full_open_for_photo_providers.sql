-- Backfill: photo providers default to FULL_OPEN when open_level is NULL.
-- This is additive/idempotent and does not override explicit PRIVATE/SEMI_OPEN.

update users u
set open_level = 'FULL_OPEN'::"OpenLevel"
where
  u.open_level is null
  and exists (
    select 1
    from user_roles r
    where r.user_id = u.id and r.role = 'PARTICIPANT'::"UserRole"
  )
  and exists (
    select 1
    from user_photos p
    where p.user_id = u.id and p.deleted_at is null
  );

-- Ensure entry_queue exists for participants (older data may not have rows)
insert into entry_queue (user_id, status, joined_at, memo)
select
  u.id,
  case
    when u.status = 'READY' and u.open_level = 'FULL_OPEN' then 'READY'::"EntryQueueStatus"
    else 'WAITING'::"EntryQueueStatus"
  end,
  now(),
  'backfill:photo-full-open'
from users u
where
  exists (
    select 1
    from user_roles r
    where r.user_id = u.id and r.role = 'PARTICIPANT'::"UserRole"
  )
  and not exists (
    select 1
    from entry_queue q
    where q.user_id = u.id
  );

-- Align existing entry_queue row with READY+FULL_OPEN eligibility
update entry_queue q
set
  status = 'READY'::"EntryQueueStatus",
  ready_at = coalesce(q.ready_at, now()),
  memo = 'backfill:photo-full-open'
where
  q.status = 'WAITING'
  and exists (
    select 1
    from users u
    where u.id = q.user_id and u.status = 'READY' and u.open_level = 'FULL_OPEN'
  );

