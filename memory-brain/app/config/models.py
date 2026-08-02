from pydantic import BaseModel
import os

class LLMConfig(BaseModel):
    fast: dict = {
        "name": "gpt-3.5-turbo",
        "api_key": os.getenv("OPENAI_API_KEY", ""),
        "cost_per_token": 0.001,
        "max_tokens": 150
    }
    heavy: dict = {
        "name": "DeepSeek-R1",
        "api_key": os.getenv("NVIDIA_API_KEY", ""),
        "cost_per_token": 0.1,
        "max_tokens": 1000
    }
