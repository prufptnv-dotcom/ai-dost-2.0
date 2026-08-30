import chromadb
from chromadb.config import Settings

client = chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))
col = client.get_or_create_collection("ai_dost_derived_index")

# ensure something is there
try:
    col.add(
        ids=["test_1", "test_2"],
        documents=["auth middleware implemented", "database connection string"],
        metadatas=[{"project_id": "test_p", "source_type": "workspace_file"}, {"project_id": "test_p", "source_type": "workspace_file"}]
    )
except Exception:
    pass

res = col.query(query_texts=["auth"], n_results=2)
print("Semantic:", res)

res2 = col.get(where_document={"$contains": "auth"})
print("Keyword:", res2)
