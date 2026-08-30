import re

with open("main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'rag_collection.delete(where={' in line:
        lines[i+1] = '                "$and": [\n'
        lines[i+2] = '                    {"project_id": {"$eq": req.project_id}},\n'
        lines[i+3] = '                    {"source_entity_id": {"$eq": doc.source_entity_id}}\n'
        lines[i+4] = '                ]\n'
        
with open("main.py", "w", encoding="utf-8") as f:
    f.writelines(lines)
