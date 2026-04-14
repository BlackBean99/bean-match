alter table users
  add column age_text varchar(30);

alter table user_photos
  alter column file_path type text,
  alter column file_url type text;

create index user_photos_user_id_stored_file_name_idx
  on user_photos(user_id, stored_file_name);
