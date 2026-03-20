-- Migration 001: initial schema
-- Creates all base tables for the wedding site.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

insert into settings (id, data)
  values (1, '{"rsvpOpenGlobal": true}')
  on conflict (id) do nothing;

create table if not exists events (
  id text primary key,
  name text not null,
  rsvp_open boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists households (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists guests (
  id text primary key,
  household_id text references households(id) on delete set null,
  name text not null,
  contact text not null default '',
  invited_event_ids jsonb not null default '[]'::jsonb,
  notes text not null default '',
  dietary_restrictions text not null default '',
  gift text not null default '',
  thank_you_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  id text primary key,
  guest_id text,
  event_id text,
  name text not null,
  rsvp text not null,
  headcount int,
  allergies text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists checklist (
  id text primary key,
  title text not null,
  sort_order int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
