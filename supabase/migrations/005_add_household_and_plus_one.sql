-- Migration 005: add household grouping and plus-one support to guests

ALTER TABLE guests ADD COLUMN IF NOT EXISTS household_id text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS plus_one_allowed boolean NOT NULL DEFAULT false;
