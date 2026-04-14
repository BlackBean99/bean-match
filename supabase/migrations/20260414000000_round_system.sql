alter type "IntroCaseStatus" add value if not exists 'A_INTERESTED' after 'OFFERED';
alter type "IntroCaseStatus" add value if not exists 'B_OFFERED' after 'A_INTERESTED';

do $$
begin
  create type "OpenLevel" as enum ('PRIVATE', 'SEMI_OPEN', 'FULL_OPEN');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "RoundStatus" as enum ('DRAFT', 'OPEN', 'CLOSED', 'MATCHING', 'COMPLETED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "EntryQueueStatus" as enum ('WAITING', 'READY', 'PROMOTED', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

alter table users
  add column if not exists open_level "OpenLevel" not null default 'PRIVATE';

create or replace function is_active_intro_case_status(status "IntroCaseStatus")
returns boolean as $$
begin
  return status in (
    'OFFERED',
    'A_INTERESTED',
    'B_OFFERED',
    'WAITING_RESPONSE',
    'MATCHED',
    'CONNECTED',
    'MEETING_DONE',
    'RESULT_PENDING'
  );
end;
$$ language plpgsql immutable;

create table if not exists rounds (
  id bigserial primary key,
  title varchar(120) not null,
  status "RoundStatus" not null default 'DRAFT',
  start_at timestamp(3) not null,
  end_at timestamp(3) not null,
  selection_limit integer not null default 2,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint rounds_selection_limit_check check (selection_limit > 0 and selection_limit <= 2),
  constraint rounds_time_check check (end_at > start_at)
);

create index if not exists rounds_status_start_at_idx on rounds(status, start_at);

create table if not exists round_selections (
  id bigserial primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  from_user_id bigint not null references users(id) on delete cascade,
  to_user_id bigint not null references users(id) on delete cascade,
  created_at timestamp(3) not null default current_timestamp,
  constraint round_selections_not_self_check check (from_user_id <> to_user_id),
  unique (round_id, from_user_id, to_user_id)
);

create index if not exists round_selections_round_id_to_user_id_idx on round_selections(round_id, to_user_id);
create index if not exists round_selections_from_user_id_idx on round_selections(from_user_id);

create table if not exists entry_queue (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  status "EntryQueueStatus" not null default 'WAITING',
  joined_at timestamp(3) not null default current_timestamp,
  ready_at timestamp(3),
  promoted_at timestamp(3),
  memo text,
  unique (user_id, status)
);

create index if not exists entry_queue_status_joined_at_idx on entry_queue(status, joined_at);

drop trigger if exists rounds_set_updated_at on rounds;
create trigger rounds_set_updated_at
before update on rounds
for each row execute function set_updated_at();

create or replace function enforce_round_selection_rules()
returns trigger as $$
declare
  selection_count integer;
  actor_status "UserStatus";
  actor_open_level "OpenLevel";
  target_status "UserStatus";
begin
  if tg_op = 'UPDATE' then
    raise exception 'round selections are immutable'
      using errcode = '23514';
  end if;

  select status, open_level
    into actor_status, actor_open_level
  from users
  where id = new.from_user_id;

  select status
    into target_status
  from users
  where id = new.to_user_id;

  if actor_status <> 'READY' or target_status <> 'READY' then
    raise exception 'round selections require READY users'
      using errcode = '23514';
  end if;

  if actor_open_level <> 'FULL_OPEN' then
    raise exception 'only FULL_OPEN users can submit round selections'
      using errcode = '23514';
  end if;

  select count(*)
    into selection_count
  from round_selections
  where round_id = new.round_id
    and from_user_id = new.from_user_id;

  if selection_count >= 2 then
    raise exception 'round selection limit exceeded'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists round_selections_enforce_rules on round_selections;
create trigger round_selections_enforce_rules
before insert or update on round_selections
for each row execute function enforce_round_selection_rules();
