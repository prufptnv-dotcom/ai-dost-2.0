# backend/app/services/vector_memory.py
import chromadb
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongodb import get_database
from app.config import settings

# Global persistent ChromaDB client to maintain data across requests
chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

class VectorMemoryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.chroma_client = chroma_client
        # Lazy load or cache model instance
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        
    async def initialize_collection(self, collection_name: str):
        """Create or get a vector collection"""
        return self.chroma_client.get_or_create_collection(collection_name)

    async def add_document(self, collection_name: str, 
                          user_id: str, 
                          document: str, 
                          source_type: str = "note"):
        """Store text as vector embedding"""
        try:
            # Generate embedding
            embedding = self.model.encode(document).tolist()
            doc_id = f"{user_id}_{source_type}_{datetime.utcnow().timestamp()}"
            
            # Store in ChromaDB collection
            collection = self.chroma_client.get_or_create_collection(collection_name)
            collection.upsert(
                embeddings=[embedding],
                documents=[document],
                ids=[doc_id],
                metadatas=[{"user_id": user_id, "source": source_type}]
            )
            
            # Record in MongoDB for metadata tracking
            await self.db.vector_memory.insert_one({
                "user_id": user_id,
                "content": document,
                "source_type": source_type,
                "created_at": datetime.utcnow()
            })
            
            return {"status": "success", "embedding_id": doc_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Vector storage failed: {str(e)}")

    async def semantic_search(self, collection_name: str, 
                            query: str, 
                            user_id: str, 
                            limit: int = 3):
        """Search for similar documents"""
        try:
            # Get embedding for query
            query_embedding = self.model.encode(query).tolist()
            
            # Search in ChromaDB collection
            collection = self.chroma_client.get_or_create_collection(collection_name)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where={"user_id": user_id}
            )
            
            # Format results from ChromaDB structure
            formatted_results = []
            if results and "documents" in results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0]
                for i in range(len(docs)):
                    formatted_results.append({
                        "document": docs[i],
                        "metadata": metas[i] if metas else {}
                    })
            
            return formatted_results
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
