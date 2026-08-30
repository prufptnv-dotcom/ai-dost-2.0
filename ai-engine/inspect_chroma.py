import chromadb
from chromadb.config import Settings
import sys

try:
    client = chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))
    collection = client.get_or_create_collection("ai_dost_derived_index")
    
    data = collection.get(include=["metadatas", "documents", "embeddings"])
    
    print(f"Total Vectors: {len(data['ids'])}")
    if data['embeddings'] and len(data['embeddings']) > 0:
        print(f"Embedding Dimension: {len(data['embeddings'][0])}")
    else:
        print("Embedding Dimension: N/A")
    
    if data['metadatas'] and len(data['metadatas']) > 0:
        models = set(m.get('embedding_model', 'unknown') for m in data['metadatas'])
        print(f"Models in metadata: {list(models)}")
        
        # Test Source Collision checks
        print("Sample metadata keys:", list(data['metadatas'][0].keys()))
    else:
        print("Models in metadata: N/A")
except Exception as e:
    print(f"Error: {e}")
