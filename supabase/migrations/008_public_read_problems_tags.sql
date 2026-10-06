-- Allow authenticated users to read Problems_duplicate and Tags tables
-- These contain public LeetCode problem data and tag mappings

CREATE POLICY "Allow authenticated read on Problems_duplicate"
  ON "Problems_duplicate"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on Tags"
  ON "Tags"
  FOR SELECT
  TO authenticated
  USING (true);
