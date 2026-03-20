-- Migration 003: login rate limit state
-- Tracks failed admin login attempts across serverless instances.

create table if not exists login_rate_limits (
  client_key text primary key,
  fail_count int not null default 0 check (fail_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_rate_limits_blocked_until_idx
  on login_rate_limits (blocked_until);
