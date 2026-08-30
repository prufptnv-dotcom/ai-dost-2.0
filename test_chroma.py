import chromadb
from chromadb.config import Settings
import hashlib
import traceback

try:
    print("Initializing Chroma...")
    client = chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))
    collection = client.get_or_create_collection(name="ai_dost_index")
    print("Collection:", collection.name)
except Exception as e:
    print("Error:", traceback.format_exc())
