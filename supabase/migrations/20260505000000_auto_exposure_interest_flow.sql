do $$
begin
  create type "InterestSource" as enum (
    'NEW_MEMBER_BROWSE',
    'NEW_MEMBER_BROADCAST',
    'ADMIN_CREATED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "InterestStatus" as enum (
    'ACTIVE',
    'WITHDRAWN',
    'EXPIRED',
    'CONVERTED_TO_INTRO'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "IntroCandidateSource" as enum (
    'MUTUAL_INTEREST',
    'ADMIN_CREATED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "IntroCandidateStatus" as enum (
    'PENDING_ADMIN_REVIEW',
    'APPROVED',
    'REJECTED',
    'CONVERTED_TO_INTRO_CASE'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "NotificationType" as enum (
    'NEW_ELIGIBLE_MEMBER'
  );
exception
  when duplicate_object then null;
end $$;

alter table users
  add column if not exists exposure_consent boolean not null default false,
  add column if not exists new_member_notifications_enabled boolean not null default true,
  add column if not exists exposure_paused boolean not null default false,
  add column if not exists exposure_paused_at timestamp(3);

update users
set exposure_consent = true
where open_level in ('SEMI_OPEN', 'FULL_OPEN')
  and exposure_consent = false;

create table if not exists interests (
  id bigserial primary key,
  from_user_id bigint not null references users(id) on delete cascade,
  to_user_id bigint not null references users(id) on delete cascade,
  source "InterestSource" not null,
  status "InterestStatus" not null default 'ACTIVE',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  expires_at timestamp(3),
  constraint interests_not_self_check check (from_user_id <> to_user_id),
  unique (from_user_id, to_user_id, source)
);

create index if not exists interests_to_user_id_status_idx on interests(to_user_id, status);
create index if not exists interests_from_user_id_status_idx on interests(from_user_id, status);

create table if not exists intro_candidates (
  id bigserial primary key,
  user_a_id bigint not null references users(id) on delete cascade,
  user_b_id bigint not null references users(id) on delete cascade,
  reason text not null,
  source "IntroCandidateSource" not null,
  status "IntroCandidateStatus" not null default 'PENDING_ADMIN_REVIEW',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  approved_at timestamp(3),
  rejected_at timestamp(3),
  converted_at timestamp(3),
  constraint intro_candidates_not_self_check check (user_a_id <> user_b_id),
  constraint intro_candidates_pair_order_check check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);

create index if not exists intro_candidates_status_created_at_idx on intro_candidates(status, created_at);

create table if not exists notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  subject_user_id bigint references users(id) on delete set null,
  type "NotificationType" not null,
  title varchar(120) not null,
  body text not null,
  link_path varchar(255),
  created_at timestamp(3) not null default current_timestamp,
  read_at timestamp(3)
);

create index if not exists notifications_user_id_created_at_idx on notifications(user_id, created_at);
create index if not exists notifications_subject_user_id_idx on notifications(subject_user_id);

drop trigger if exists interests_set_updated_at on interests;
create trigger interests_set_updated_at
before update on interests
for each row execute function set_updated_at();

drop trigger if exists intro_candidates_set_updated_at on intro_candidates;
create trigger intro_candidates_set_updated_at
before update on intro_candidates
for each row execute function set_updated_at();
