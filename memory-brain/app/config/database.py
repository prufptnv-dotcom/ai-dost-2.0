import chromadb
from pydantic import BaseModel
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

class VectorDBConfig(BaseModel):
    url: str = os.getenv("VECTOR_DB_URL", "localhost:6235")
    name: str = os.getenv("VECTOR_DB_NAME", "coding_assistant")

def get_vector_db():
    try:
        client = chromadb.Client()
        db = client.get_or_create_collection(name=VectorDBConfig().name)
        logger.info("Connected to vector database collection")
        return db
    except Exception as e:
        logger.error(f"Vector DB connection failed: {e}")
        # In-memory fallback collection for local testing
        client = chromadb.Client()
        return client.get_or_create_collection(name="coding_assistant_fallback")

vector_db = get_vector_db()
