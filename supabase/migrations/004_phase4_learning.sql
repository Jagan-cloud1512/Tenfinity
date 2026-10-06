-- Phase 4: Learning System
-- skill_classifications: stores user's computed level (A/B/C) based on assessment scores
-- learning_progress: tracks which topics user is learning, materials viewed, problems attempted
-- problem_suggestions: tracks which problems have been suggested to avoid repeats

-- Skill classification per user
CREATE TABLE IF NOT EXISTS skill_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mcq_score_percent REAL DEFAULT 0,
    coding_score_percent REAL DEFAULT 0,
    overall_score_percent REAL DEFAULT 0,
    level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C')) DEFAULT 'A',
    classified_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Learning progress per topic per user
CREATE TABLE IF NOT EXISTS learning_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES dsa_topics(id),
    topic_status TEXT NOT NULL CHECK (topic_status IN ('known', 'unknown')),
    learning_status TEXT NOT NULL CHECK (learning_status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    materials_viewed BOOLEAN DEFAULT FALSE,
    problems_suggested INT DEFAULT 0,
    problems_completed INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, topic_id)
);

-- Track which problems have been suggested to each user (no repeats)
CREATE TABLE IF NOT EXISTS problem_suggestions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL,
    topic_id INT NOT NULL REFERENCES dsa_topics(id),
    suggested_at TIMESTAMPTZ DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, problem_id)
);

-- RLS policies
ALTER TABLE skill_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_suggestions ENABLE ROW LEVEL SECURITY;

-- skill_classifications: users read own, service_role full access
CREATE POLICY "Users read own classification" ON skill_classifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on classifications" ON skill_classifications
    FOR ALL USING (auth.role() = 'service_role');

-- learning_progress: users read own, service_role full access
CREATE POLICY "Users read own learning progress" ON learning_progress
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on learning progress" ON learning_progress
    FOR ALL USING (auth.role() = 'service_role');

-- problem_suggestions: users read/update own, service_role full access
CREATE POLICY "Users read own suggestions" ON problem_suggestions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own suggestions" ON problem_suggestions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on suggestions" ON problem_suggestions
    FOR ALL USING (auth.role() = 'service_role');
