import httpx
import json
import asyncio
import logging
from app.config import settings

logger = logging.getLogger(__name__)

async def call_groq(system_prompt: str, user_prompt: str, model="llama-3.1-8b-instant") -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set in environment variables.")
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 4000
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"Groq API Error: {response.text}")
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_gemini(system_prompt: str, user_prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    
    # Gemini requires a specific payload structure
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"System Guidelines: {system_prompt}\n\nUser Request: {user_prompt}"}]}
        ],
        "generationConfig": {
            "temperature": 0.2
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise ValueError(f"Unexpected Gemini response format: {data}")

async def call_llm_with_fallback(system_prompt: str, user_prompt: str) -> str:
    """
    Cascading LLM Router: Tries Groq first, falls back to Gemini.
    """
    try:
        logger.info("Attempting primary LLM (Groq)...")
        return await call_groq(system_prompt, user_prompt)
    except Exception as e:
        logger.error(f"Groq failed: {e}. Switching to Gemini fallback...")
        try:
            return await call_gemini(system_prompt, user_prompt)
        except Exception as fallback_e:
            logger.error(f"Gemini fallback also failed: {fallback_e}")
            raise Exception("All LLM providers failed. Please check API keys or network.")
