-- Fix unique constraints to include learning_phase
-- These may have been partially applied from migrations 006/007

-- problem_suggestions: need UNIQUE(user_id, problem_id, learning_phase)
ALTER TABLE problem_suggestions DROP CONSTRAINT IF EXISTS problem_suggestions_user_id_problem_id_key;
ALTER TABLE problem_suggestions DROP CONSTRAINT IF EXISTS problem_suggestions_user_problem_phase_key;
ALTER TABLE problem_suggestions ADD CONSTRAINT problem_suggestions_user_problem_phase_key UNIQUE (user_id, problem_id, learning_phase);

-- learning_progress: need UNIQUE(user_id, topic_id, learning_phase)
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_user_id_topic_id_key;
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_user_topic_phase_key;
ALTER TABLE learning_progress ADD CONSTRAINT learning_progress_user_topic_phase_key UNIQUE (user_id, topic_id, learning_phase);
