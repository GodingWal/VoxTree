-- VoxTree Initial Schema
-- Creates core tables for users, voices, content, and generated clips

-- ============================================================
-- TABLES
-- ============================================================

-- Extends Supabase auth.users with app-specific fields
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'family')),
  voice_slots_used int not null default 0,
  clips_used_this_month int not null default 0,
  clips_reset_at timestamptz not null default now(),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Family member voice clones
create table public.family_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  elevenlabs_voice_id text,
  sample_audio_url text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Curated content library (videos, stories)
create table public.content_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  series text,
  episode_number int,
  original_video_url text not null,
  thumbnail_url text,
  duration_seconds int,
  age_range text,
  tags text[] default '{}',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

-- Generated clips (voice-replaced videos)
create table public.generated_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_id uuid not null references public.content_library(id) on delete cascade,
  voice_id uuid not null references public.family_voices(id) on delete cascade,
  output_audio_url text,
  output_video_url text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  cached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_family_voices_user_id on public.family_voices(user_id);
create index idx_generated_clips_user_id on public.generated_clips(user_id);
create index idx_generated_clips_cache_lookup on public.generated_clips(content_id, voice_id, status);
create index idx_content_library_series on public.content_library(series);
create index idx_content_library_premium on public.content_library(is_premium);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.family_voices enable row level security;
alter table public.content_library enable row level security;
alter table public.generated_clips enable row level security;

-- Users: can read and update their own row
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

-- Family voices: users can CRUD their own voices
create policy "Users can read own voices"
  on public.family_voices for select
  using (auth.uid() = user_id);

create policy "Users can insert own voices"
  on public.family_voices for insert
  with check (auth.uid() = user_id);

create policy "Users can update own voices"
  on public.family_voices for update
  using (auth.uid() = user_id);

create policy "Users can delete own voices"
  on public.family_voices for delete
  using (auth.uid() = user_id);

-- Content library: all authenticated users can read
create policy "Authenticated users can read content"
  on public.content_library for select
  using (auth.role() = 'authenticated');

-- Generated clips: users can CRUD their own clips
create policy "Users can read own clips"
  on public.generated_clips for select
  using (auth.uid() = user_id);

create policy "Users can insert own clips"
  on public.generated_clips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clips"
  on public.generated_clips for update
  using (auth.uid() = user_id);

create policy "Users can delete own clips"
  on public.generated_clips for delete
  using (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();

create trigger family_voices_updated_at
  before update on public.family_voices
  for each row execute function public.update_updated_at();

create trigger generated_clips_updated_at
  before update on public.generated_clips
  for each row execute function public.update_updated_at();
