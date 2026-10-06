-- Phase 5+6: Final Assessment & Level Progression
-- final_assessments: per-phase final coding assessment
-- final_assessment_problems: coding problems for final assessments (difficulty-aware)
-- level_progression: tracks current learning phase and promotion history
-- learning_progress: add learning_phase column for multi-phase support

-- ============================================================
-- 1. Level Progression table
-- ============================================================
CREATE TABLE IF NOT EXISTS level_progression (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    initial_level TEXT NOT NULL CHECK (initial_level IN ('A', 'B', 'C')) DEFAULT 'A',
    current_phase TEXT NOT NULL CHECK (current_phase IN ('A', 'B', 'C', 'COMPLETE')) DEFAULT 'A',
    phases_completed TEXT[] DEFAULT '{}',
    promoted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================
-- 2. Final Assessments table
-- ============================================================
CREATE TABLE IF NOT EXISTS final_assessments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phase TEXT NOT NULL CHECK (phase IN ('A', 'B', 'C')),
    status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'in_progress', 'completed')),
    total_problems INT DEFAULT 2,
    total_tests_passed INT DEFAULT 0,
    total_tests INT DEFAULT 0,
    score_percent NUMERIC(5,2) DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- 3. Final Assessment Problems table
-- ============================================================
CREATE TABLE IF NOT EXISTS final_assessment_problems (
    id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL REFERENCES final_assessments(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES dsa_topics(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    starter_code TEXT NOT NULL,
    test_cases JSONB NOT NULL,
    user_code TEXT,
    passed_count INT DEFAULT 0,
    total_count INT DEFAULT 0,
    submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'running', 'passed', 'failed', 'error')),
    display_order INT DEFAULT 1,
    submitted_at TIMESTAMPTZ
);

-- ============================================================
-- 4. Add learning_phase to learning_progress
-- ============================================================
ALTER TABLE learning_progress
    ADD COLUMN IF NOT EXISTS learning_phase TEXT NOT NULL DEFAULT 'A'
    CHECK (learning_phase IN ('A', 'B', 'C'));

-- Drop old unique constraint and add new one with learning_phase
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_user_id_topic_id_key;
ALTER TABLE learning_progress ADD CONSTRAINT learning_progress_user_topic_phase_key UNIQUE (user_id, topic_id, learning_phase);

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE level_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_assessment_problems ENABLE ROW LEVEL SECURITY;

-- level_progression
CREATE POLICY "Users read own progression" ON level_progression
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on progression" ON level_progression
    FOR ALL USING (auth.role() = 'service_role');

-- final_assessments
CREATE POLICY "Users read own final assessments" ON final_assessments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on final assessments" ON final_assessments
    FOR ALL USING (auth.role() = 'service_role');

-- final_assessment_problems: users read via join
CREATE POLICY "Users read own final problems" ON final_assessment_problems
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM final_assessments fa
            WHERE fa.id = final_assessment_problems.assessment_id
            AND fa.user_id = auth.uid()
        )
    );
CREATE POLICY "Service role full access on final problems" ON final_assessment_problems
    FOR ALL USING (auth.role() = 'service_role');
