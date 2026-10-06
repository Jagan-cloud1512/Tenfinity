-- Add learning_phase to problem_suggestions so problems can be re-suggested in new phases
ALTER TABLE problem_suggestions
    ADD COLUMN IF NOT EXISTS learning_phase TEXT NOT NULL DEFAULT 'A'
    CHECK (learning_phase IN ('A', 'B', 'C'));

-- Drop old unique constraint and replace with phase-aware one
ALTER TABLE problem_suggestions DROP CONSTRAINT IF EXISTS problem_suggestions_user_id_problem_id_key;
ALTER TABLE problem_suggestions ADD CONSTRAINT problem_suggestions_user_problem_phase_key UNIQUE (user_id, problem_id, learning_phase);
