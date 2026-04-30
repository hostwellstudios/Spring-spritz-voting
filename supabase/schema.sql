-- ============================================================
-- SPRITZ COMPETITION — SUPABASE SCHEMA
-- Run this once in the Supabase SQL editor for your project.
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

create table drinks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  team_members text[] not null default '{}',
  created_at   timestamptz default now()
);

create table guests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  drink_id   uuid references drinks(id) on delete set null,
  created_at timestamptz default now()
);

create table tasting_notes (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid not null references guests(id) on delete cascade,
  drink_id         uuid not null references drinks(id) on delete cascade,
  note_text        text not null default '',
  share_anonymous  boolean not null default false,
  created_at       timestamptz default now(),
  unique (guest_id, drink_id)
);

create table votes (
  id         uuid primary key default gen_random_uuid(),
  guest_id   uuid not null references guests(id) on delete cascade,
  drink_id   uuid not null references drinks(id) on delete cascade,
  category   text not null check (category in ('taste', 'creativity', 'presentation')),
  rank       integer not null check (rank >= 1),
  created_at timestamptz default now(),
  unique (guest_id, drink_id, category)
);

-- Singleton row: enforced by primary key = 1 constraint
create table app_state (
  id              integer primary key default 1 check (id = 1),
  phase           text not null default 'onboarding'
                    check (phase in ('onboarding', 'tasting', 'voting', 'results')),
  results_shared  boolean not null default false
);

insert into app_state (id, phase, results_shared) values (1, 'onboarding', false);

-- ============================================================
-- MIGRATION (run if table already exists)
-- alter table app_state add column results_shared boolean not null default false;
-- ============================================================

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- All guest operations use the anon key (open read/write for
-- a closed private party). Admin writes use the service_role
-- key in the browser, which bypasses RLS entirely.

alter table drinks        enable row level security;
alter table guests        enable row level security;
alter table tasting_notes enable row level security;
alter table votes         enable row level security;
alter table app_state     enable row level security;

-- drinks: anon can read; writes blocked (service_role used by admin)
create policy "drinks_select" on drinks for select using (true);
create policy "drinks_insert" on drinks for insert with check (false);
create policy "drinks_update" on drinks for update using (false);
create policy "drinks_delete" on drinks for delete using (false);

-- guests: anon can read + insert
create policy "guests_select" on guests for select using (true);
create policy "guests_insert" on guests for insert with check (true);

-- tasting_notes: open read/write (closed party, no sensitive data)
create policy "notes_select" on tasting_notes for select using (true);
create policy "notes_insert" on tasting_notes for insert with check (true);
create policy "notes_update" on tasting_notes for update using (true);

-- votes: open read/write; uniqueness constraint prevents duplicates
create policy "votes_select" on votes for select using (true);
create policy "votes_insert" on votes for insert with check (true);

-- app_state: anon can read; updates blocked (service_role used by admin)
create policy "state_select" on app_state for select using (true);
create policy "state_update" on app_state for update using (false);

-- ============================================================
-- REALTIME
-- Enable realtime on the tables that need live updates.
-- In Supabase dashboard: Database → Replication → enable for:
--   app_state, drinks, votes
-- ============================================================
