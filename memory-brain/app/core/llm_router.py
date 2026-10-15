import httpx
import json
import asyncio
import logging
from app.config import settings

logger = logging.getLogger(__name__)

async def call_groq(system_prompt: str, user_prompt: str, model="llama-3.3-70b-versatile", history=None) -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set in environment variables.")
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
                
    messages.append({"role": "user", "content": user_prompt})
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4000
    }
    
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"Groq API Error: {response.text}")
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_nvidia_glm(system_prompt: str, user_prompt: str, history=None) -> str:
    if not settings.NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY is not set.")
        
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
                
    messages.append({"role": "user", "content": user_prompt})
    
    payload = {
        "model": "z-ai/glm-5.2",
        "messages": messages,
        "temperature": 1,
        "top_p": 1,
        "max_tokens": 16384,
        "seed": 42
    }
    
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"NVIDIA API Error: {response.text}")
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_gemini_robotics_vision(image_path: str, prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Upload image
    uploaded_file = client.files.upload(file=image_path)
    
    # Interact with robotics model
    image_response = client.interactions.create(
        model="gemini-robotics-er-2-preview",
        input=[
            {
                "type": "image",
                "uri": uploaded_file.uri,
                "mime_type": uploaded_file.mime_type
            },
            {"type": "text", "text": prompt}
        ],
        generation_config={"thinking_level": "high"},
    )
    
    return image_response.output_text

async def call_gemini(system_prompt: str, user_prompt: str, history=None) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    
    contents = []
    if history:
        for msg in history:
            role = msg.get("role", "user")
            gemini_role = "user" if role == "user" else "model"
            content = msg.get("content", "")
            if content:
                contents.append({"role": gemini_role, "parts": [{"text": content}]})
                
    # Add system prompt to the current user prompt if no history, otherwise it's just user prompt
    final_user_text = f"System Guidelines: {system_prompt}\n\nUser Request: {user_prompt}" if not history else user_prompt
    
    # If using history, we need to inject system instructions in the systemInstruction field.
    # But for simplicity, we just inject it into the first user message or as a system block.
    contents.append({"role": "user", "parts": [{"text": final_user_text}]})
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2
        }
    }
    
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise ValueError(f"Unexpected Gemini response format: {data}")

async def call_g4f(system_prompt: str, user_prompt: str) -> str:
    """
    GPT4Free (g4f) fallback.
    Uses free web endpoints without API keys.
    """
    import g4f
    from g4f.client import AsyncClient
    import nest_asyncio
    nest_asyncio.apply()
    
    client = AsyncClient()
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
    return response.choices[0].message.content

async def call_ollama(system_prompt: str, user_prompt: str, model="llama3", history=None) -> str:
    """
    100% Free Local Fallback using Ollama.
    Requires Ollama to be installed and running locally with the specified model.
    """
    url = "http://localhost:11434/api/chat"
    
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_prompt})
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]

async def call_llm_with_fallback(system_prompt: str, user_prompt: str, history=None) -> str:
    """
    Cascading LLM Router: Tries Groq first, falls back to Gemini.
    """
    try:
        logger.info("Attempting primary LLM (Nvidia GLM)...")
        return await call_nvidia_glm(system_prompt, user_prompt, history=history)
    except Exception as e:
        logger.error(f"Nvidia failed: {e}. Switching to Groq fallback...")
        try:
            return await call_groq(system_prompt, user_prompt, history=history)
        except Exception as fallback_groq_e:
            logger.error(f"Groq failed: {fallback_groq_e}. Switching to Gemini fallback...")
        try:
            return await call_gemini(system_prompt, user_prompt, history=history)
        except Exception as fallback_e:
            logger.error(f"Gemini fallback also failed: {fallback_e}. Switching to Ollama (Local) fallback...")
            try:
                return await call_ollama(system_prompt, user_prompt, history=history)
            except Exception as ollama_e:
                logger.error(f"Ollama fallback failed: {ollama_e}")
                return "API Rate Limit Reached for Groq & Gemini. Please wait 1-2 minutes before sending another message, or start Ollama locally for free unlimited offline chat."
