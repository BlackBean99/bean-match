create table if not exists read_only_browse_tokens (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  label varchar(120) not null,
  token_hash varchar(64) not null unique,
  token_hint varchar(24) not null,
  expires_at timestamp(3),
  last_used_at timestamp(3),
  revoked_at timestamp(3),
  created_at timestamp(3) not null default current_timestamp
);

create index if not exists read_only_browse_tokens_user_id_created_at_idx
  on read_only_browse_tokens(user_id, created_at desc);
