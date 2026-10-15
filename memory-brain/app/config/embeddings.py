import requests
import os
import numpy as np
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY")
        self.endpoint = os.getenv("NVIDIA_EMBEDDING_ENDPOINT", "https://api.nvidia.com/v1/embeddings")
        self.model = os.getenv("NVIDIA_EMBEDDING_MODEL", "nemo-qa-embedder")

    def generate_embedding(self, text: str) -> np.ndarray:
        try:
            if not self.api_key:
                # Deterministic fallback vector if API key is not yet set
                return np.zeros(384)
            headers = {
                "Authorization": f"Token {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "input": text
            }
            response = requests.post(self.endpoint, headers=headers, json=payload, timeout=10)
            response.raise_for_status()
            embedding = response.json()["embedding"]
            return np.array(embedding)
        except requests.exceptions.RequestException as e:
            logger.error(f"Embedding service error: {e}")
            return np.zeros(384)
