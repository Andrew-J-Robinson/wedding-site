-- Migration 004: admin token revocation list
-- Stores revoked JWT IDs (jti) for admin tokens.

create table if not exists admin_token_revocations (
  jti text primary key,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists admin_token_revocations_expires_at_idx
  on admin_token_revocations (expires_at);
