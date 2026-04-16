-- Migration 008: add has_kids flag to guests

ALTER TABLE guests ADD COLUMN IF NOT EXISTS has_kids boolean NOT NULL DEFAULT false;
