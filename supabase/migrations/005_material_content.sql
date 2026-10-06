-- Phase 4 addition: persist generated learning material per user per topic
ALTER TABLE learning_progress ADD COLUMN IF NOT EXISTS material_content TEXT;
