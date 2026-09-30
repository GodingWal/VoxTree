-- Identities are versioned independently from movie characters.
create table public.digital_actors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'capture_required' check (status in ('capture_required','processing','ready','failed')),
  identity jsonb not null,
  consent jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.digital_actor_versions (
  actor_id uuid not null references public.digital_actors(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  version integer not null check(version > 0),
  identity jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,version),
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create table public.digital_actor_assets (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  user_id uuid not null,
  actor_version integer not null check(actor_version > 0),
  kind text not null check(kind in ('face','body','voice','hair','skin','realistic','stylized','preview','production')),
  storage_key text not null unique,
  content_type text not null,
  bytes bigint not null check(bytes > 0),
  model_id text,
  model_version text,
  dependencies uuid[] not null default '{}',
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create table public.digital_actor_jobs (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null, user_id uuid not null,
  actor_version integer not null check(actor_version > 0),
  stage text not null check(stage in ('CAPTURE_PROCESS','FACE_RECONSTRUCT','BODY_RECONSTRUCT','AVATAR_BUILD','AVATAR_STYLIZE','PREVIEW_GENERATE','RENDER_PACKAGE_GENERATE')),
  status text not null default 'queued' check(status in ('queued','running','completed','failed','retrying')),
  attempts integer not null default 0, max_attempts integer not null default 3,
  lease_token uuid, locked_until timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(actor_id,actor_version,stage),
  foreign key(actor_id,user_id) references public.digital_actors(id,user_id) on delete cascade
);
create index digital_actor_jobs_pending on public.digital_actor_jobs(status,created_at);
alter table public.digital_actors enable row level security;
alter table public.digital_actor_versions enable row level security;
alter table public.digital_actor_assets enable row level security;
alter table public.digital_actor_jobs enable row level security;
create policy actor_owner on public.digital_actors for all using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy actor_version_owner on public.digital_actor_versions for select using(user_id = auth.uid());
create policy actor_asset_owner on public.digital_actor_assets for select using(user_id = auth.uid());
create policy actor_job_owner on public.digital_actor_jobs for select using(user_id = auth.uid());
