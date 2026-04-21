create table if not exists round_passes (
  id bigserial primary key,
  round_id bigint not null references rounds(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  reason text,
  created_at timestamp(3) not null default current_timestamp,
  unique (round_id, user_id)
);

create index if not exists round_passes_round_id_idx on round_passes(round_id, created_at desc);
create index if not exists round_passes_user_id_idx on round_passes(user_id, created_at desc);
