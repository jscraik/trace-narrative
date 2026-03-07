-- Add trust_pause_reason column to recovery checkpoints
-- This carries forward the failure reason to prevent misclassification on restart

ALTER TABLE trust_recovery_checkpoints ADD COLUMN trust_pause_reason TEXT;

-- Update schema version for existing rows (they have no trust_pause_reason, which is valid)
-- No data migration needed; NULL is the default state
