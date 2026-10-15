import os
import glob
import numpy as np
from app.config.embeddings import EmbeddingService
from app.config.database import vector_db
import logging

logger = logging.getLogger(__name__)

class VectorDBService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.chunk_size = 512
    
    def process_repository(self, repo_path: str):
        try:
            logger.info(f"Processing repository: {repo_path}")
            files = glob.glob(f"{repo_path}/**/*", recursive=True)
            
            for file in files:
                if file.endswith((".py", ".js", ".ts", ".java", ".c", ".cpp")):
                    try:
                        with open(file, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        chunks = self._chunk_code(content)
                        for i, chunk in enumerate(chunks):
                            embedding = self.embedding_service.generate_embedding(chunk)
                            vector_db.add(
                                embeddings=[embedding.tolist()],
                                ids=[f"{file}:{i}"],
                                metadatas=[{"language": self._detect_language(file), "file": file}],
                                documents=[chunk]
                            )
                    except Exception as e:
                        logger.error(f"Error processing file {file}: {e}")
            logger.info("Repository processing completed")
        except Exception as e:
            logger.error(f"Repository processing failed: {e}")
            raise
    
    def _chunk_code(self, text: str, chunk_size: int = 512) -> list[str]:
        lines = text.split("\n")
        chunks = []
        current_chunk = []
        current_length = 0
        
        for line in lines:
            if current_length + len(line) > chunk_size:
                chunks.append("\n".join(current_chunk))
                current_chunk = []
                current_length = 0
            current_chunk.append(line)
            current_length += len(line)
        
        if current_chunk:
            chunks.append("\n".join(current_chunk))
        
        return chunks
    
    def _detect_language(self, file_path: str) -> str:
        ext = file_path.split(".")[-1]
        languages = {
            "py": "Python",
            "js": "JavaScript",
            "ts": "TypeScript",
            "java": "Java",
            "c": "C",
            "cpp": "C++"
        }
        return languages.get(ext, "Unknown")
    
    def query_context(self, query: str, k: int = 5) -> list[dict]:
        try:
            embedding = self.embedding_service.generate_embedding(query)
            results = vector_db.query(query_embeddings=[embedding.tolist()], n_results=k)
            
            formatted_results = []
            if results and "documents" in results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if "metadatas" in results else []
                for i in range(len(docs)):
                    formatted_results.append({
                        "text": docs[i],
                        "metadata": metas[i] if i < len(metas) else {}
                    })
            return formatted_results
        except Exception as e:
            logger.error(f"Vector DB query failed: {e}")
            return []
