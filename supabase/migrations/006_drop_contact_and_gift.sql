-- Migration 006: remove contact and gift columns from guests

ALTER TABLE IF EXISTS guests
  DROP COLUMN IF EXISTS contact,
  DROP COLUMN IF EXISTS gift;
