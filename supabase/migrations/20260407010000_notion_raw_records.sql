create table notion_raw_records (
  id bigserial primary key,
  source_type varchar(50) not null,
  source_id varchar(100) not null,
  source_name varchar(100) not null,
  notion_page_id varchar(100) not null unique,
  payload jsonb not null,
  checksum varchar(64) not null,
  last_synced_at timestamp(3) not null default current_timestamp,
  notion_edited_at timestamp(3)
);

create index notion_raw_records_source_type_source_id_idx
  on notion_raw_records(source_type, source_id);
