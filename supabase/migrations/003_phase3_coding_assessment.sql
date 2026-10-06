-- Phase 3: Coding Assessment tables

CREATE TABLE coding_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'generating'
        CHECK (status IN ('generating', 'in_progress', 'completed')),
    total_problems INT DEFAULT 0,
    passed_problems INT DEFAULT 0,
    score_percent NUMERIC(5,2) DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE coding_problems (
    id SERIAL PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES coding_assessments(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES dsa_topics(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    starter_code TEXT,
    test_cases JSONB NOT NULL,
    user_code TEXT,
    passed_count INT DEFAULT 0,
    total_count INT DEFAULT 0,
    submission_status TEXT DEFAULT 'pending'
        CHECK (submission_status IN ('pending', 'running', 'passed', 'failed', 'error')),
    submitted_at TIMESTAMPTZ,
    display_order INT NOT NULL
);

-- RLS
ALTER TABLE coding_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coding assessments"
    ON coding_assessments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own coding assessments"
    ON coding_assessments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to coding_assessments"
    ON coding_assessments FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own coding problems"
    ON coding_problems FOR SELECT
    USING (
        assessment_id IN (
            SELECT id FROM coding_assessments WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own coding problems"
    ON coding_problems FOR UPDATE
    USING (
        assessment_id IN (
            SELECT id FROM coding_assessments WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to coding_problems"
    ON coding_problems FOR ALL
    USING (auth.role() = 'service_role');
