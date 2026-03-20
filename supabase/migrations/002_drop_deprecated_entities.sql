-- Migration 002: remove deprecated entities and fields
-- Removes events, households, checklist, and related guest/rsvp columns.

alter table if exists guests
  drop column if exists household_id,
  drop column if exists invited_event_ids;

alter table if exists rsvps
  drop column if exists event_id;

drop table if exists checklist;
drop table if exists households;
drop table if exists events;
