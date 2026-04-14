-- Backfill entry_queue so existing PARTICIPANT users are also tracked.
-- This is additive and idempotent.

insert into entry_queue (user_id, status, joined_at, memo)
select
  u.id,
  case
    when u.status = 'READY' and u.open_level = 'FULL_OPEN' then 'READY'::"EntryQueueStatus"
    else 'WAITING'::"EntryQueueStatus"
  end,
  now(),
  'backfill:20260414'
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

