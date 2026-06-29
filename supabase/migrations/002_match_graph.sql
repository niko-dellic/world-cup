alter table public.matches
  add column if not exists match_number integer,
  add column if not exists visual_slot integer,
  add column if not exists home_source_match_id text,
  add column if not exists away_source_match_id text,
  add column if not exists home_source_label text,
  add column if not exists away_source_label text;

create unique index if not exists matches_match_number_idx
on public.matches (match_number)
where match_number is not null;

create index if not exists matches_visual_slot_idx
on public.matches (round, visual_slot);

create index if not exists matches_source_match_ids_idx
on public.matches (home_source_match_id, away_source_match_id);
