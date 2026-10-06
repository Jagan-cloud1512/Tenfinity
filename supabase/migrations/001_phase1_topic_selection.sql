-- ============================================================
-- Phase 1 Migration: Topic Selection
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);


-- 2. DSA Topics (reference table)
CREATE TABLE IF NOT EXISTS dsa_topics (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    display_order INT NOT NULL,
    description TEXT DEFAULT ''
);

ALTER TABLE dsa_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read topics"
    ON dsa_topics FOR SELECT
    TO authenticated
    USING (true);


-- 3. User topic selections
CREATE TABLE IF NOT EXISTS user_topics (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES dsa_topics(id) ON DELETE CASCADE,
    self_reported_status TEXT NOT NULL CHECK (self_reported_status IN ('known', 'unknown')),
    selected_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own topic selections"
    ON user_topics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic selections"
    ON user_topics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic selections"
    ON user_topics FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic selections"
    ON user_topics FOR DELETE
    USING (auth.uid() = user_id);


-- 4. Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 5. Seed DSA topics
INSERT INTO dsa_topics (name, slug, category, display_order, description) VALUES
    ('Arrays', 'arrays', 'Linear', 1, 'Contiguous memory, indexing, traversal, manipulation'),
    ('Strings', 'strings', 'Linear', 2, 'Character arrays, pattern matching, manipulation'),
    ('Linked List', 'linked-list', 'Linear', 3, 'Singly, doubly, circular linked lists'),
    ('Stack', 'stack', 'Linear', 4, 'LIFO operations, monotonic stacks, expression evaluation'),
    ('Queue', 'queue', 'Linear', 5, 'FIFO operations, deque, priority queue basics'),
    ('Hashing', 'hashing', 'Linear', 6, 'Hash maps, hash sets, collision handling'),
    ('Recursion', 'recursion', 'Fundamental', 7, 'Base cases, recursive thinking, call stack'),
    ('Sorting', 'sorting', 'Fundamental', 8, 'Comparison sorts, counting sort, merge sort, quick sort'),
    ('Searching', 'searching', 'Fundamental', 9, 'Linear search, binary search, search space reduction'),
    ('Trees', 'trees', 'Hierarchical', 10, 'Binary trees, traversals, properties'),
    ('BST', 'bst', 'Hierarchical', 11, 'Binary search trees, operations, balancing concepts'),
    ('Heap', 'heap', 'Hierarchical', 12, 'Min/max heaps, heapify, priority queues'),
    ('Graphs', 'graphs', 'Graph', 13, 'Representations, BFS, DFS, connected components'),
    ('Trie', 'trie', 'Advanced', 14, 'Prefix trees, autocomplete, word search'),
    ('Greedy', 'greedy', 'Algorithmic', 15, 'Greedy choice property, interval scheduling, Huffman'),
    ('Backtracking', 'backtracking', 'Algorithmic', 16, 'Constraint satisfaction, permutations, N-Queens'),
    ('Dynamic Programming', 'dynamic-programming', 'Algorithmic', 17, 'Overlapping subproblems, memoization, tabulation'),
    ('Graph Algorithms', 'graph-algorithms', 'Graph', 18, 'Shortest path, MST, topological sort, cycle detection')
ON CONFLICT (slug) DO NOTHING;
