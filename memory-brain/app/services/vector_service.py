import chromadb
from sentence_transformers import SentenceTransformer
from app.config import settings
from typing import List, Dict, Any

class VectorService:
    _model = None
    _chroma_client = None
    _collection = None

    @classmethod
    def get_model(cls):
        """Lazy load the sentence transformer model to save memory at startup"""
        if cls._model is None:
            print(f"Loading Embedding Model: {settings.EMBEDDING_MODEL}...")
            cls._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            print("Embedding Model Loaded Successfully!")
        return cls._model

    @classmethod
    def get_collection(cls):
        """Lazy load and initialize ChromaDB client and collection"""
        if cls._chroma_client is None:
            cls._chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            # Create or get collection
            cls._collection = cls._chroma_client.get_or_create_collection(
                name="user_memories",
                metadata={"hnsw:space": "cosine"}
            )
        return cls._collection

    @classmethod
    async def add_memory(cls, user_id: str, content: str, doc_id: str, metadata: Dict[str, Any] = None):
        """Generate embedding and add memory to ChromaDB"""
        collection = cls.get_collection()
        model = cls.get_model()
        
        # Generate embedding
        embedding = model.encode(content).tolist()
        
        # Prepare metadata
        meta = metadata or {}
        meta["user_id"] = user_id
        
        # Add to ChromaDB
        collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[meta],
            ids=[doc_id]
        )
        return True

    @classmethod
    async def query_memory(cls, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Query similar memories for a specific user using cosine similarity"""
        collection = cls.get_collection()
        model = cls.get_model()
        
        # Generate query embedding
        query_embedding = model.encode(query).tolist()
        
        # Query ChromaDB with user filter
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where={"user_id": user_id}
        )
        
        memories = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            ids = results["ids"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
            
            for i in range(len(docs)):
                memories.append({
                    "id": ids[i],
                    "content": docs[i],
                    "metadata": metas[i],
                    "similarity": 1.0 - distances[i]  # Cosine similarity from cosine distance
                })
        
        return memories

    @classmethod
    async def delete_memory(cls, doc_id: str):
        """Delete specific memory from ChromaDB"""
        collection = cls.get_collection()
        collection.delete(ids=[doc_id])
        return True
