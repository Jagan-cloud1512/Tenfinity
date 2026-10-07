import sys
sys.path.insert(0, "/home/ubuntu/Tenfinity/backend")
from app.services.supabase_client import get_supabase_admin

db = get_supabase_admin()
USER_ID = "7fde3fa2-781a-4b61-9c52-bf4b5772300b"
PHASE = "B"

topics = db.table("user_topics").select("topic_id").eq("user_id", USER_ID).execute()
topic_ids = [t["topic_id"] for t in topics.data]
print(f"Found {len(topic_ids)} topics")

for tid in topic_ids:
    existing = db.table("learning_progress").select("id").eq("user_id", USER_ID).eq("topic_id", tid).eq("learning_phase", PHASE).execute()
    if existing.data:
        db.table("learning_progress").update({"learning_status": "completed", "materials_viewed": True, "problems_suggested": 5, "problems_completed": 5}).eq("user_id", USER_ID).eq("topic_id", tid).eq("learning_phase", PHASE).execute()
    else:
        db.table("learning_progress").insert({"user_id": USER_ID, "topic_id": tid, "learning_phase": PHASE, "learning_status": "completed", "topic_status": "completed", "materials_viewed": True, "problems_suggested": 5, "problems_completed": 5}).execute()
    print(f"  Done topic {tid}")

print("All topics completed!")
