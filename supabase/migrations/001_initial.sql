create extension if not exists pgcrypto;

create table if not exists public.teams (
  id text primary key,
  provider_id text,
  name text not null,
  short_name text not null,
  country_code text,
  flag_emoji text,
  colors text[] not null default array['#0ea5e9', '#f97316'],
  updated_at timestamptz not null default now(),
  constraint teams_colors_pair check (array_length(colors, 1) >= 2)
);

create table if not exists public.matches (
  id text primary key,
  provider_id text,
  round text not null check (round in ('round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'final')),
  round_name text not null,
  slot integer not null check (slot > 0),
  kickoff_time timestamptz,
  status text not null default 'unknown' check (status in ('scheduled', 'live', 'completed', 'postponed', 'unknown')),
  home_team_id text references public.teams(id) on delete set null,
  away_team_id text references public.teams(id) on delete set null,
  home_score integer,
  away_score integer,
  winner_team_id text references public.teams(id) on delete set null,
  provider_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (round, slot)
);

create table if not exists public.prediction_brackets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous' check (char_length(display_name) between 1 and 48),
  picks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.bracket_refreshes (
  id bigint generated always as identity primary key,
  source text not null,
  match_count integer not null default 0,
  refreshed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at
before update on public.teams
for each row execute function public.touch_updated_at();

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
before update on public.matches
for each row execute function public.touch_updated_at();

drop trigger if exists prediction_brackets_touch_updated_at on public.prediction_brackets;
create trigger prediction_brackets_touch_updated_at
before update on public.prediction_brackets
for each row execute function public.touch_updated_at();

alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.prediction_brackets enable row level security;
alter table public.bracket_refreshes enable row level security;

drop policy if exists "Teams are public read" on public.teams;
create policy "Teams are public read"
on public.teams for select
to anon, authenticated
using (true);

drop policy if exists "Matches are public read" on public.matches;
create policy "Matches are public read"
on public.matches for select
to anon, authenticated
using (true);

drop policy if exists "Refresh logs are public read" on public.bracket_refreshes;
create policy "Refresh logs are public read"
on public.bracket_refreshes for select
to anon, authenticated
using (true);

drop policy if exists "Users read own prediction" on public.prediction_brackets;
create policy "Users read own prediction"
on public.prediction_brackets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own prediction" on public.prediction_brackets;
create policy "Users insert own prediction"
on public.prediction_brackets for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own prediction" on public.prediction_brackets;
create policy "Users update own prediction"
on public.prediction_brackets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists matches_round_slot_idx on public.matches (round, slot);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists prediction_brackets_user_id_idx on public.prediction_brackets (user_id);
