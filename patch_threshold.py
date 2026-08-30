import os

main_path = "ai-engine/main.py"
with open(main_path, "r", encoding="utf-8") as f:
    text = f.read()

old_code = """
                    norm_score = 1.0 / (1.0 + dist)
                    
                    kw_score = 1.0 if (mode == "HYBRID" and meta.get("source_entity_id") in entity_candidates and entity_candidates[meta["source_entity_id"]]["chunk_id"] == c_id) else 0.0
                    
                    add_candidate(meta, c_id, sem_score=norm_score, kw_score=kw_score)
"""
new_code = """
                    norm_score = 1.0 / (1.0 + dist)
                    
                    kw_score = 1.0 if (mode == "HYBRID" and meta.get("source_entity_id") in entity_candidates and entity_candidates[meta["source_entity_id"]]["chunk_id"] == c_id) else 0.0
                    
                    # Apply semantic threshold
                    if norm_score > 0.4 or kw_score > 0:
                        add_candidate(meta, c_id, sem_score=norm_score, kw_score=kw_score)
"""

if old_code.strip() in text:
    text = text.replace(old_code.strip(), new_code.strip())
    with open(main_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Patched main.py threshold successfully")
else:
    print("Could not find old_code in main.py")
