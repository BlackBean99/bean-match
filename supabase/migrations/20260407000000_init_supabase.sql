create type "UserStatus" as enum (
  'INCOMPLETE',
  'READY',
  'PROGRESSING',
  'HOLD',
  'STOP_REQUESTED',
  'ARCHIVED',
  'BLOCKED'
);

create type "UserRole" as enum (
  'PARTICIPANT',
  'INVITOR',
  'ADMIN'
);

create type "Gender" as enum (
  'FEMALE',
  'MALE',
  'OTHER',
  'UNDISCLOSED'
);

create type "PhotoType" as enum (
  'PROFILE'
);

create type "IntroCaseStatus" as enum (
  'OFFERED',
  'WAITING_RESPONSE',
  'MATCHED',
  'CONNECTED',
  'MEETING_DONE',
  'RESULT_PENDING',
  'SUCCESS',
  'FAILED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED'
);

create type "IntroParticipantRole" as enum (
  'PERSON_A',
  'PERSON_B'
);

create type "IntroResponseStatus" as enum (
  'PENDING',
  'ACCEPTED',
  'DECLINED'
);

create table users (
  id bigserial primary key,
  name varchar(50) not null,
  gender "Gender" not null,
  status "UserStatus" not null default 'INCOMPLETE',
  birth_date date,
  phone varchar(30),
  contact_visible boolean not null default false,
  height_cm integer,
  job_title varchar(100),
  company_name varchar(100),
  self_intro text,
  ideal_type_description text,
  main_photo_id bigint,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  stop_requested_at timestamp(3),
  archived_at timestamp(3),
  blocked_at timestamp(3),
  blocked_reason varchar(255)
);

create table user_roles (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  role "UserRole" not null,
  created_at timestamp(3) not null default current_timestamp,
  unique (user_id, role)
);

create table user_preferences (
  id bigserial primary key,
  user_id bigint not null unique references users(id) on delete cascade,
  preferred_gender "Gender",
  preferred_age_min integer,
  preferred_age_max integer,
  preferred_height_min integer,
  preferred_height_max integer,
  preferred_job_text varchar(255),
  preferred_style_text text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

create table user_photos (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  photo_type "PhotoType" not null,
  original_file_name varchar(255) not null,
  stored_file_name varchar(255) not null,
  file_path varchar(500) not null,
  file_url varchar(500),
  mime_type varchar(100) not null,
  file_size_bytes bigint not null,
  width_px integer,
  height_px integer,
  sort_order integer not null default 0,
  is_main boolean not null default false,
  uploaded_at timestamp(3) not null default current_timestamp,
  deleted_at timestamp(3)
);

create index user_photos_user_id_is_main_idx on user_photos(user_id, is_main);

alter table users
  add constraint users_main_photo_id_fkey
  foreign key (main_photo_id) references user_photos(id) on delete set null;

create table intro_cases (
  id bigserial primary key,
  status "IntroCaseStatus" not null,
  invitor_user_id bigint references users(id) on delete set null,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  offered_at timestamp(3),
  matched_at timestamp(3),
  connected_at timestamp(3),
  meeting_done_at timestamp(3),
  result_confirmed_at timestamp(3),
  closed_at timestamp(3),
  memo text
);

create table intro_case_participants (
  id bigserial primary key,
  intro_case_id bigint not null references intro_cases(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  participant_role "IntroParticipantRole" not null,
  response_status "IntroResponseStatus",
  responded_at timestamp(3),
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  unique (intro_case_id, user_id)
);

create index intro_case_participants_user_id_idx on intro_case_participants(user_id);

create table intro_case_events (
  id bigserial primary key,
  intro_case_id bigint not null references intro_cases(id) on delete cascade,
  from_status "IntroCaseStatus",
  to_status "IntroCaseStatus" not null,
  actor_user_id bigint references users(id) on delete set null,
  event_type varchar(50) not null,
  memo text,
  created_at timestamp(3) not null default current_timestamp
);

create index intro_case_events_intro_case_id_created_at_idx on intro_case_events(intro_case_id, created_at);

create table user_state_history (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  from_status "UserStatus",
  to_status "UserStatus" not null,
  actor_user_id bigint references users(id) on delete set null,
  reason_code varchar(50) not null,
  memo text,
  created_at timestamp(3) not null default current_timestamp
);

create index user_state_history_user_id_created_at_idx on user_state_history(user_id, created_at);

create table notion_sync_records (
  id bigserial primary key,
  entity_type varchar(50) not null,
  entity_id bigint not null,
  notion_page_id varchar(100) not null unique,
  checksum varchar(64) not null,
  last_synced_at timestamp(3) not null default current_timestamp,
  notion_edited_at timestamp(3),
  unique (entity_type, entity_id)
);

create index notion_sync_records_entity_type_idx on notion_sync_records(entity_type);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$ language plpgsql;

create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

create trigger user_preferences_set_updated_at
before update on user_preferences
for each row execute function set_updated_at();

create trigger intro_cases_set_updated_at
before update on intro_cases
for each row execute function set_updated_at();

create trigger intro_case_participants_set_updated_at
before update on intro_case_participants
for each row execute function set_updated_at();

create or replace function is_active_intro_case_status(status "IntroCaseStatus")
returns boolean as $$
begin
  return status in (
    'OFFERED',
    'WAITING_RESPONSE',
    'MATCHED',
    'CONNECTED',
    'MEETING_DONE',
    'RESULT_PENDING'
  );
end;
$$ language plpgsql immutable;

create or replace function prevent_multiple_active_intro_cases()
returns trigger as $$
declare
  conflict_count integer;
begin
  select count(*)
    into conflict_count
  from intro_case_participants participant
  join intro_cases intro_case on intro_case.id = participant.intro_case_id
  where participant.user_id = new.user_id
    and participant.id <> coalesce(new.id, 0)
    and is_active_intro_case_status(intro_case.status);

  if conflict_count > 0 and exists (
    select 1
    from intro_cases intro_case
    where intro_case.id = new.intro_case_id
      and is_active_intro_case_status(intro_case.status)
  ) then
    raise exception 'user % already has an active intro case', new.user_id
      using errcode = '23505';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger intro_case_participants_prevent_multiple_active
before insert or update on intro_case_participants
for each row execute function prevent_multiple_active_intro_cases();

create or replace function prevent_status_change_to_multiple_active_intro_cases()
returns trigger as $$
declare
  conflicted_user_id bigint;
begin
  if not is_active_intro_case_status(new.status) then
    return new;
  end if;

  select participant.user_id
    into conflicted_user_id
  from intro_case_participants participant
  join intro_case_participants other_participant
    on other_participant.user_id = participant.user_id
   and other_participant.intro_case_id <> participant.intro_case_id
  join intro_cases other_intro_case
    on other_intro_case.id = other_participant.intro_case_id
  where participant.intro_case_id = new.id
    and is_active_intro_case_status(other_intro_case.status)
  limit 1;

  if conflicted_user_id is not null then
    raise exception 'user % already has an active intro case', conflicted_user_id
      using errcode = '23505';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger intro_cases_prevent_multiple_active
before insert or update of status on intro_cases
for each row execute function prevent_status_change_to_multiple_active_intro_cases();
