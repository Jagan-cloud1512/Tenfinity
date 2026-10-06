"""Tag all Problems_duplicate rows using LeetCode's official tags via GraphQL API."""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from app.services.supabase_client import get_supabase_admin

DSA_TOPICS = [
    "Arrays", "Strings", "Linked List", "Stack", "Queue", "Hashing",
    "Recursion", "Sorting", "Searching", "Trees", "BST", "Heap",
    "Graphs", "Trie", "Greedy", "Backtracking", "Dynamic Programming",
    "Graph Algorithms",
]

# Map LeetCode tag names → our DSA topic names
LEETCODE_TO_DSA = {
    "array": "Arrays",
    "matrix": "Arrays",
    "two pointers": "Arrays",
    "sliding window": "Arrays",
    "prefix sum": "Arrays",
    "string": "Strings",
    "string matching": "Strings",
    "linked list": "Linked List",
    "doubly-linked list": "Linked List",
    "stack": "Stack",
    "monotonic stack": "Stack",
    "queue": "Queue",
    "monotonic queue": "Queue",
    "hash table": "Hashing",
    "hash function": "Hashing",
    "rolling hash": "Hashing",
    "recursion": "Recursion",
    "memoization": "Recursion",
    "sorting": "Sorting",
    "merge sort": "Sorting",
    "quickselect": "Sorting",
    "counting sort": "Sorting",
    "radix sort": "Sorting",
    "bucket sort": "Sorting",
    "binary search": "Searching",
    "binary indexed tree": "Searching",
    "tree": "Trees",
    "binary tree": "Trees",
    "segment tree": "Trees",
    "binary search tree": "BST",
    "ordered set": "BST",
    "heap (priority queue)": "Heap",
    "priority queue": "Heap",
    "graph": "Graphs",
    "union find": "Graphs",
    "minimum spanning tree": "Graph Algorithms",
    "shortest path": "Graph Algorithms",
    "topological sort": "Graph Algorithms",
    "strongly connected component": "Graph Algorithms",
    "eulerian circuit": "Graph Algorithms",
    "network flow": "Graph Algorithms",
    "trie": "Trie",
    "greedy": "Greedy",
    "backtracking": "Backtracking",
    "dynamic programming": "Dynamic Programming",
    "bitmask": "Dynamic Programming",
    "depth-first search": "Graphs",
    "breadth-first search": "Graphs",
    "divide and conquer": "Recursion",
}

GRAPHQL_QUERY = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: {}
  ) {
    total: totalNum
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      topicTags {
        name
      }
    }
  }
}
"""


def fetch_all_leetcode_problems():
    """Fetch all LeetCode problems with their tags via GraphQL."""
    all_questions = []
    skip = 0
    batch_size = 100

    with httpx.Client(timeout=30) as client:
        while True:
            print(f"  Fetching LeetCode problems {skip+1}-{skip+batch_size}...", flush=True)
            resp = client.post(
                "https://leetcode.com/graphql",
                json={
                    "query": GRAPHQL_QUERY,
                    "variables": {
                        "categorySlug": "algorithms",
                        "limit": batch_size,
                        "skip": skip,
                    },
                },
                headers={
                    "Content-Type": "application/json",
                    "Referer": "https://leetcode.com",
                },
            )
            data = resp.json()
            questions = data["data"]["problemsetQuestionList"]["questions"]
            total = data["data"]["problemsetQuestionList"]["total"]

            all_questions.extend(questions)
            skip += batch_size

            if skip >= total or not questions:
                break
            time.sleep(1)

    return all_questions


def map_tags(leetcode_tags: list[dict]) -> list[str]:
    """Map LeetCode tags to our 18 DSA topics."""
    mapped = []
    for tag in leetcode_tags:
        name = tag["name"].lower()
        if name in LEETCODE_TO_DSA:
            topic = LEETCODE_TO_DSA[name]
            if topic not in mapped:
                mapped.append(topic)
    return mapped


def main():
    db = get_supabase_admin()

    # Step 1: Setup Tags table
    print("Setting up Tags table...", flush=True)
    for i, topic in enumerate(DSA_TOPICS, start=1):
        try:
            db.table("Tags").upsert({"TagID": i, "Problems": []}).execute()
        except Exception as e:
            print(f"  Warning: {topic} (ID={i}): {e}", flush=True)
    topic_to_id = {t: i for i, t in enumerate(DSA_TOPICS, start=1)}
    print(f"  {len(DSA_TOPICS)} tags ready", flush=True)

    # Step 2: Fetch all LeetCode problems with tags
    print("\nFetching LeetCode tags via GraphQL...", flush=True)
    lc_problems = fetch_all_leetcode_problems()
    print(f"  Fetched {len(lc_problems)} problems from LeetCode", flush=True)

    # Build lookup: title (lowercased) → tags
    lc_lookup = {}
    for q in lc_problems:
        lc_lookup[q["title"].lower()] = q["topicTags"]
        lc_lookup[q["titleSlug"]] = q["topicTags"]

    # Step 3: Fetch our DB problems
    print("\nFetching problems from database...", flush=True)
    all_problems = []
    offset = 0
    while True:
        batch = db.table("Problems_duplicate").select("ProblemID, ProblemName, URL").range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_problems.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    print(f"  {len(all_problems)} problems in DB", flush=True)

    # Step 4: Match and tag
    print("\nTagging problems...", flush=True)
    tag_to_problems = {i: [] for i in range(1, len(DSA_TOPICS) + 1)}
    stats = {t: 0 for t in DSA_TOPICS}
    matched = 0
    unmatched = 0
    unmatched_names = []

    for idx, p in enumerate(all_problems):
        name = p["ProblemName"]
        slug = p.get("URL", "").rstrip("/").split("/")[-1] if p.get("URL") else ""

        lc_tags = lc_lookup.get(name.lower()) or lc_lookup.get(slug)

        if lc_tags:
            dsa_topics = map_tags(lc_tags)
            if dsa_topics:
                tag_ids = [topic_to_id[t] for t in dsa_topics]
                db.table("Problems_duplicate").update({"Tags": tag_ids}).eq("ProblemID", p["ProblemID"]).execute()
                for t in dsa_topics:
                    stats[t] += 1
                    tag_to_problems[topic_to_id[t]].append(p["ProblemID"])
                matched += 1
            else:
                # Has LeetCode tags but none map to our topics (e.g. Math, Design)
                db.table("Problems_duplicate").update({"Tags": [topic_to_id["Arrays"]]}).eq("ProblemID", p["ProblemID"]).execute()
                stats["Arrays"] += 1
                tag_to_problems[topic_to_id["Arrays"]].append(p["ProblemID"])
                matched += 1
        else:
            unmatched += 1
            unmatched_names.append(name)
            # Default to Arrays
            db.table("Problems_duplicate").update({"Tags": [topic_to_id["Arrays"]]}).eq("ProblemID", p["ProblemID"]).execute()
            stats["Arrays"] += 1
            tag_to_problems[topic_to_id["Arrays"]].append(p["ProblemID"])

        if (idx + 1) % 200 == 0:
            print(f"  Processed {idx + 1}/{len(all_problems)} (matched: {matched}, unmatched: {unmatched})", flush=True)

    # Step 5: Update Tags table
    print("\nUpdating Tags table with problem lists...", flush=True)
    for tid, problems in tag_to_problems.items():
        db.table("Tags").update({"Problems": problems}).eq("TagID", tid).execute()

    # Summary
    print(f"\n{'='*50}", flush=True)
    print(f"TAGGING COMPLETE", flush=True)
    print(f"{'='*50}", flush=True)
    print(f"Total: {len(all_problems)} | Matched: {matched} | Unmatched: {unmatched}", flush=True)
    print(f"\nPer-topic distribution:", flush=True)
    for topic in DSA_TOPICS:
        print(f"  {topic:25s}: {stats[topic]:>4d} problems", flush=True)

    if unmatched_names[:10]:
        print(f"\nSample unmatched: {unmatched_names[:10]}", flush=True)


if __name__ == "__main__":
    main()
