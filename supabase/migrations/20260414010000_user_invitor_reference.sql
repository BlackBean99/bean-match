alter table users
  add column if not exists invited_by_user_id bigint references users(id) on delete set null;

create index if not exists users_invited_by_user_id_idx on users(invited_by_user_id);
