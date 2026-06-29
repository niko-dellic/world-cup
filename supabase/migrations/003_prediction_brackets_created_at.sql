alter table public.prediction_brackets
  add column if not exists created_at timestamptz;

update public.prediction_brackets
set created_at = timestamp with time zone '2026-06-29 00:00:00+00'
where created_at is null;

alter table public.prediction_brackets
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists prediction_brackets_created_at_idx
on public.prediction_brackets (created_at);
