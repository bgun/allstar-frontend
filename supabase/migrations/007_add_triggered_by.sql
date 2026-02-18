-- Add triggered_by to agent_runs to track who initiated the run
-- NULL = automated/scheduled, otherwise stores the user's display name
ALTER TABLE agent_runs ADD COLUMN triggered_by TEXT;
