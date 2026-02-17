-- Migration 006: Grading system tables for allstar-agent

-- Add raw_data column to listings (description already exists)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- ============================================================
-- grading_criteria: versioned prompt templates
-- ============================================================
CREATE TABLE grading_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  criteria_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grading_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grading_criteria" ON grading_criteria
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service_role can write (no explicit policy needed — service_role bypasses RLS)

-- Seed v1 criteria
INSERT INTO grading_criteria (version, criteria_prompt, is_active) VALUES (
  'v1',
  E'You are a salvage headlight grading expert. Evaluate the following eBay/Craigslist listing for a salvage auto headlight and return a JSON object with these fields:\n\n- score: integer 1-100\n- grade_letter: one of A, B, C, D, F\n- rationale: 2-3 sentence explanation\n- flags: array of short flag strings (e.g. "no photos", "as-is disclaimer", "aftermarket")\n\nEvaluation criteria (weight each appropriately):\n\n1. OEM vs Aftermarket: OEM/genuine parts score higher. Aftermarket or unbranded score lower.\n2. Price relative to value: Compare asking price to typical market value for the part. Overpriced listings score lower.\n3. Condition keywords: Penalize listings mentioning "cracked", "hazing", "moisture", "foggy", "broken tab", "damaged". Reward "clean", "clear", "tested working", "mint".\n4. Photo count and quality: More photos = higher confidence. No photos is a major red flag. Blurry or stock photos score lower.\n5. Seller reputation: High-rated sellers with many transactions score higher. New sellers or low ratings score lower.\n6. Shipping and location proximity to Brooklyn 11221: Local pickup or nearby = bonus. Expensive shipping or far distance = slight penalty.\n7. Completeness: Listings that include ballast, harness, mounting hardware, or are sold as a pair score higher.\n8. Fitment specificity: Listings that specify exact year/make/model/side score higher than generic "fits many" listings.\n9. Red flags: "as-is", "untested", "for parts only", "no returns", "sold as-is" are significant negatives.\n\nGrading scale:\n- A (90-100): Excellent deal, OEM, well-documented, good price, trustworthy seller\n- B (75-89): Good listing, minor concerns\n- C (60-74): Average, some risk factors\n- D (40-59): Below average, multiple concerns\n- F (1-39): Poor listing, major red flags, likely not worth buying\n\nReturn ONLY valid JSON. No markdown, no explanation outside the JSON object.',
  true
);

-- ============================================================
-- agent_runs: track each agent execution
-- ============================================================
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  listings_scraped INTEGER DEFAULT 0,
  listings_graded INTEGER DEFAULT 0,
  listings_failed INTEGER DEFAULT 0,
  average_score NUMERIC,
  prompt_version TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agent_runs" ON agent_runs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- grades: per-listing grading results
-- ============================================================
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 100),
  grade_letter TEXT NOT NULL CHECK (grade_letter IN ('A', 'B', 'C', 'D', 'F')),
  rationale TEXT,
  flags TEXT[],
  model_used TEXT,
  prompt_version TEXT,
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, prompt_version)
);

CREATE INDEX idx_grades_listing_id ON grades(listing_id);
CREATE INDEX idx_grades_prompt_version ON grades(prompt_version);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grades" ON grades
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- buyer_feedback: user feedback on grades
-- ============================================================
CREATE TABLE buyer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('agree', 'disagree', 'partially_agree')),
  adjusted_score INTEGER CHECK (adjusted_score IS NULL OR (adjusted_score >= 1 AND adjusted_score <= 100)),
  notes TEXT,
  would_buy BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyer_feedback_grade_id ON buyer_feedback(grade_id);
CREATE INDEX idx_buyer_feedback_user_id ON buyer_feedback(user_id);

ALTER TABLE buyer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view buyer_feedback" ON buyer_feedback
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own feedback" ON buyer_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- agent_events: real-time event log for agent activity
-- ============================================================
CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_events_run_id ON agent_events(run_id);
CREATE INDEX idx_agent_events_created_at ON agent_events(created_at DESC);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agent_events" ON agent_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Enable Supabase Realtime on agent_events
ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
