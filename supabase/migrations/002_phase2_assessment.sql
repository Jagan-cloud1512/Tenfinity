-- ============================================================
-- Phase 2 Migration: Initial Assessment
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Assessments (one active assessment per user)
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'generating'
        CHECK (status IN ('generating', 'in_progress', 'completed')),
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    score_percent NUMERIC(5,2) DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assessments"
    ON assessments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
    ON assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments"
    ON assessments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments"
    ON assessments FOR DELETE
    USING (auth.uid() = user_id);


-- 2. Assessment questions
CREATE TABLE IF NOT EXISTS assessment_questions (
    id SERIAL PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES dsa_topics(id),
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'code_output')),
    difficulty TEXT NOT NULL DEFAULT 'medium',
    question_text TEXT NOT NULL,
    code_snippet TEXT,
    code_language TEXT DEFAULT 'python',
    options JSONB NOT NULL,
    correct_index INT NOT NULL,
    explanation TEXT,
    user_answer INT,
    is_correct BOOLEAN,
    answered_at TIMESTAMPTZ,
    display_order INT NOT NULL
);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assessment questions"
    ON assessment_questions FOR SELECT
    USING (
        assessment_id IN (
            SELECT id FROM assessments WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own assessment questions"
    ON assessment_questions FOR UPDATE
    USING (
        assessment_id IN (
            SELECT id FROM assessments WHERE user_id = auth.uid()
        )
    );
