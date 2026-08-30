import os

main_path = "ai-engine/main.py"
with open(main_path, "r", encoding="utf-8") as f:
    text = f.read()

# We need to replace the rag_query function block.
import re

new_query_func = """
AUTHORITY_SCORES = {
    "workspace_file": 1.0,
    "artifact": 0.9,
    "verification_result": 0.9,
    "context_node": 0.8,
    "message": 0.6,
    "execution_history": 0.5
}

def get_authority_score(source_type: str) -> float:
    return AUTHORITY_SCORES.get(source_type, 0.5)

@app.post("/ai/rag/query", response_model=RetrievalResponse)
def rag_query(req: RetrievalRequest):
    \"\"\"
    Phase 2F.4 Hybrid Retrieval & Ranking
    \"\"\"
    if not req.project_id:
        raise HTTPException(400, "project_id is required for tenant isolation")
    
    if not rag_collection:
        raise HTTPException(503, "Vector store is unavailable")

    query_text = req.query.strip()
    if not query_text:
        return RetrievalResponse(version=req.version, results=[])

    mode = (req.mode or "HYBRID").upper()
    if mode not in ["EXACT", "FULL_TEXT", "SEMANTIC", "HYBRID"]:
        raise HTTPException(400, "unsupported mode")

    limit = req.filters.limit if req.filters and req.filters.limit else 10
    limit = max(1, min(limit, 100))

    where_filter = {"project_id": {"$eq": req.project_id}}
    
    if req.filters and req.filters.source_types:
        if len(req.filters.source_types) == 1:
            where_filter = {
                "$and": [
                    {"project_id": {"$eq": req.project_id}},
                    {"source_type": {"$eq": req.filters.source_types[0]}}
                ]
            }
        else:
            where_filter = {
                "$and": [
                    {"project_id": {"$eq": req.project_id}},
                    {"source_type": {"$in": req.filters.source_types}}
                ]
            }

    entity_candidates = {}

    def add_candidate(meta, chunk_id, sem_score, kw_score):
        src_id = meta.get("source_entity_id")
        if not src_id: return
        auth_score = get_authority_score(meta.get("source_type", ""))
        
        # Ranking Formula
        # alpha=0.6, beta=0.3, gamma=0.1
        final_score = (0.6 * sem_score) + (0.3 * kw_score) + (0.1 * auth_score)

        if src_id not in entity_candidates or final_score > entity_candidates[src_id]["score"]:
            entity_candidates[src_id] = {
                "source_entity_id": src_id,
                "project_id": meta.get("project_id", req.project_id),
                "source_type": meta.get("source_type", "unknown"),
                "chunk_id": chunk_id,
                "score": final_score,
                "version_hash": meta.get("version_hash", ""),
                "metadata": {k: v for k, v in meta.items() if str(k).startswith("custom_")}
            }

    try:
        if mode in ["FULL_TEXT", "HYBRID", "EXACT"]:
            kw_results = rag_collection.get(
                where=where_filter,
                where_document={"$contains": query_text}
            )
            if kw_results and kw_results["ids"]:
                for idx, c_id in enumerate(kw_results["ids"]):
                    add_candidate(kw_results["metadatas"][idx], c_id, sem_score=0.0, kw_score=1.0)
                    
        if mode in ["SEMANTIC", "HYBRID"]:
            sem_results = rag_collection.query(
                query_texts=[query_text],
                n_results=limit * 3,
                where=where_filter
            )
            if sem_results and sem_results["ids"] and len(sem_results["ids"][0]) > 0:
                for idx, c_id in enumerate(sem_results["ids"][0]):
                    dist = sem_results["distances"][0][idx]
                    meta = sem_results["metadatas"][0][idx]
                    
                    norm_score = 1.0 / (1.0 + dist)
                    
                    kw_score = 1.0 if (mode == "HYBRID" and meta.get("source_entity_id") in entity_candidates and entity_candidates[meta["source_entity_id"]]["chunk_id"] == c_id) else 0.0
                    
                    add_candidate(meta, c_id, sem_score=norm_score, kw_score=kw_score)
                    
    except Exception as e:
        if mode == "HYBRID":
            pass # Fallback to whatever candidates we have
        else:
            raise HTTPException(500, f"Retrieval failed: {str(e)}")

    sorted_results = sorted(entity_candidates.values(), key=lambda x: x["score"], reverse=True)
    return RetrievalResponse(version=req.version, results=sorted_results[:limit])
"""

# Find rag_query definition and replace up to the next # --- block
import re

pattern = re.compile(r'@app\.post\("/ai/rag/query", response_model=RetrievalResponse\)\ndef rag_query\(req: RetrievalRequest\):.*?return RetrievalResponse\(version=req\.version, results=\[\]\)', re.DOTALL)

if pattern.search(text):
    text = pattern.sub(new_query_func, text)
    with open(main_path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Patched main.py successfully")
else:
    print("Could not find the target block in main.py!")
