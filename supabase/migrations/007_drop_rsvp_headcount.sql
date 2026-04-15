-- Migration 007: remove headcount column from rsvps

ALTER TABLE IF EXISTS rsvps
  DROP COLUMN IF EXISTS headcount;
