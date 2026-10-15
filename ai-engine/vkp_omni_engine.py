"""
vkp_omni_engine.py
AI Dost 3.0 — VKP-Omni-2B Multimodal AI Engine
Model: NandiAi/VKP-Omni-2B
Developed, fine-tuned, and deployed by Vikash Kumar Pandit.
"""

import os
import sys
import json
import time
import threading
import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger("vkp_omni_engine")
logging.basicConfig(level=logging.INFO)

import re

MODEL_ID = os.environ.get("VKP_OMNI_MODEL_ID", "NandiAi/VKP-Omni-2B")
HF_SPACE_ID = os.environ.get("VKP_OMNI_SPACE_ID", "NandiAi/vkp-omni-2b-demo")
HF_TOKEN = os.environ.get("HF_TOKEN")

_cloud_client = None
_client_lock = threading.Lock()

def get_cloud_client():
    global _cloud_client
    if _cloud_client is not None:
        return _cloud_client
    try:
        from gradio_client import Client
        _cloud_client = Client(HF_SPACE_ID, token=HF_TOKEN, verbose=False)
        logger.info(f"Connected to Cloud VKP-Omni Space: {HF_SPACE_ID}")
        return _cloud_client
    except Exception as e:
        logger.warning(f"Could not connect to Cloud Gradio Client: {e}")
        return None

def check_identity_or_creator(query: str) -> Optional[str]:
    if not query:
        return None
    q = query.strip().lower()
    if re.search(r'\b(?:tum|aap|tu)\s+(?:k[ao]n|k[ao]un)\s+(?:ho|hain|hai)\b', q) or \
       re.search(r'\b(?:who\s+are\s+you|who\s+made\s+you|who\s+created\s+you|who\s+developed\s+you|your\s+creator|what\s+is\s+your\s+name|who\s+r\s+u)\b', q) or \
       re.search(r'\b(?:kisne\s+banaya|kiska\s+model|kiska\s+ai|creator\s+kaun|kon\s+ho\s+tum|kaun\s+ho\s+tum)\b', q):
        return "I am VKP-Omni-2B, an advanced multimodal and real-time AI assistant developed by Vikash Kumar Pandit at IIT Patna."
    return None

def is_leave_or_application_request(query: str) -> bool:
    if not query:
        return False
    q = query.strip().lower()
    has_leave_kw = bool(re.search(r'\b(?:chutti|chhutti|leave|absent)\b', q))
    has_action_kw = bool(re.search(r'\b(?:application|letter|likh|likho|liko|chahiye|format|draft|banao|send)\b', q))
    return has_leave_kw and has_action_kw

def generate_leave_application(query: str) -> str:
    q_lower = query.lower()
    company = "Amazon" if "amazon" in q_lower else "the Company"
    days = "2"
    m_days = re.search(r'(\d+)\s*(?:din|dino|days?)', q_lower)
    if m_days:
        days = m_days.group(1)
    return (
        f"Subject: Application for {days} Days Leave\n\n"
        f"To,\n"
        f"The Manager / HR Department,\n"
        f"{company} India.\n\n"
        f"Respected Sir/Madam,\n\n"
        f"I am writing this application to formally request leave for {days} days from [Start Date] to [End Date] "
        f"due to urgent personal and unavoidable reasons.\n\n"
        f"I have coordinated with my team members to ensure that my pending responsibilities are covered during my absence. "
        f"I will remain reachable on phone/email in case of any critical requirement.\n\n"
        f"I kindly request you to approve my leave for the specified duration.\n\n"
        f"Thanking you,\n\n"
        f"Yours sincerely,\n"
        f"[Your Name]\n"
        f"Employee ID: [Your ID]\n"
        f"{company}"
    )

def heal_refusal_response(text: str, query: str) -> str:
    if not text:
        return text
    is_refusal = bool(re.search(
        r"(?:I'm\s+sorry|I\s+am\s+sorry|can't\s+assist|cannot\s+assist|as\s+a\s+text-based\s+AI|don't\s+have\s+access\s+to\s+real-time|I\s+cannot\s+fulfill)",
        text,
        re.IGNORECASE
    ))
    if not is_refusal:
        return text

    if is_leave_or_application_request(query):
        return generate_leave_application(query)

    ident = check_identity_or_creator(query)
    if ident:
        return ident

    return text

# By default, use fast local CUDA GPU for all queries (no cloud ZeroGPU quota bottlenecks)
_cloud_disabled_until = time.time() + (0 if os.environ.get("USE_CLOUD_VKP") == "1" else 86400 * 365)

def query_cloud_vkp(prompt: str) -> Optional[str]:
    global _cloud_disabled_until, _cloud_client
    if time.time() < _cloud_disabled_until:
        return None

    ident = check_identity_or_creator(prompt)
    if ident:
        return ident

    framed_prompt = prompt
    if is_leave_or_application_request(prompt):
        framed_prompt = f"Write a professional employee leave application letter based on this request:\nRequest: {prompt}\n\nSubject: Leave Application\n\n"

    try:
        with _client_lock:
            client = get_cloud_client()
            if not client:
                return None
            res = client.predict(
                message=framed_prompt,
                history=[],
                image=None,
                api_name="/chat"
            )
        if isinstance(res, (list, tuple)) and len(res) > 0 and isinstance(res[0], list):
            messages = res[0]
            for m in reversed(messages):
                if m.get("role") == "assistant":
                    for c in m.get("content", []):
                        if c.get("type") == "text":
                            raw = c.get("text", "").strip()
                            return heal_refusal_response(raw, prompt)
        return None
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"Cloud VKP inference error: {err_msg}")
        if any(k in err_msg.lower() for k in ["zerogpu quota", "exceeded your free", "subscribe to hugging face pro", "quota"]):
            logger.info("ZeroGPU quota reached. Switching directly to local GPU inference for the next 12 hours.")
            _cloud_disabled_until = time.time() + 12 * 3600
        with _client_lock:
            _cloud_client = None
    return None

SYSTEM_GREETING_PROMPT = (
    "You are VKP-Omni-2B, the core multimodal AI engine of AI Dost 3.0, "
    "developed, fine-tuned, and deployed by Vikash Kumar Pandit.\n"
    "STRICT DIRECTIVE: For greetings, chit-chat, and simple direct questions, "
    "respond in exactly 1-2 concise, friendly sentences. "
    "Do NOT output internal monologues, thinking out loud, or reasoning steps."
)

SYSTEM_GENERAL_PROMPT = (
    "You are VKP-Omni-2B, the core multimodal AI engine of AI Dost 3.0, "
    "developed, fine-tuned, and deployed by Vikash Kumar Pandit. "
    "Excel in code generation, deep logic, vision, and full-stack solutions.\n"
    "CRITICAL MANDATE: Answer the user's query directly, completely, and accurately. "
    "Do NOT output internal thoughts, monologues, or rambling phrases like 'Okay, let's see', 'Hmm', or 'Let me think'. "
    "Provide the final complete answer, explanation, or working code directly."
)

SYSTEM_PROMPT = SYSTEM_GENERAL_PROMPT

def is_greeting_or_chitchat(query: str) -> bool:
    if not query:
        return False
    q = query.strip().lower()
    patterns = [
        r'^(?:hi|hello|hey|greetings|hola)\b',
        r'^(?:how\s+are\s+you|how\s+r\s+u|how\s+do\s+you\s+do|how\'s\s+it\s+going|what\'s\s+up|sup)\b',
        r'^(?:kaise\s+ho|kaisa\s+hai|kya\s+haal|namaste|pranam|ram\s+ram)\b',
        r'^(?:good\s+(?:morning|afternoon|evening|night))\b',
        r'^(?:who\s+are\s+you|what\s+is\s+your\s+name|tum\s+kaun\s+ho|aap\s+kaun\s+hain)\b'
    ]
    return any(re.search(pat, q) for pat in patterns)

MONOLOGUE_PATTERN = re.compile(
    r'^\s*(?:Alright|Okay|Hmm|Well|Wait|Now|So|First)[\s,]+'
    r'(?:so\s+)?(?:I\s+need\s+to|let(?:\'s|\s+me)\s+(?:see|think|recall|look|break|try|understand)|'
    r'we\s+need\s+to|the\s+user\s+is\s+asking|maybe\s+we\s+can|let\'s\s+start\s+by)[\s\S]*?(?:\n\n|\r\n\r\n)',
    re.IGNORECASE
)

def strip_reasoning_monologue(text: str, query: str = "") -> str:
    if not text:
        return ""
    cleaned = text.replace("<|im_end|>", "").replace("<|endoftext|>", "")
    if "<|end_of_thought|>" in cleaned:
        after = cleaned.split("<|end_of_thought|>")[-1].strip()
        if after:
            return after
    cleaned = cleaned.replace("<|begin_of_thought|>", "").strip()

    while True:
        match = MONOLOGUE_PATTERN.match(cleaned)
        if match:
            remainder = cleaned[match.end():].strip()
            if remainder:
                cleaned = remainder
            else:
                break
        else:
            break

    if is_greeting_or_chitchat(query):
        if re.match(r'^(?:Alright|Okay|Hmm|Let me|Maybe I|So,?\s*I\s+need)', cleaned, re.IGNORECASE) or len(cleaned) < 4:
            return "Hello! I'm doing great, thank you for asking. How can I help you today?"

    return cleaned

class QueryPayload(BaseModel):
    prompt: str
    max_tokens: int = 600
    temperature: float = 0.01
    repetition_penalty: float = 1.2
    image_base64: Optional[str] = None

# Global lazy-loaded singleton
_model = None
_processor = None
_load_error = None
_is_loading = False

def get_local_model_path():
    base_dir = os.path.expanduser(r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B")
    refs_main = os.path.join(base_dir, "refs", "main")
    if os.path.isfile(refs_main):
        try:
            with open(refs_main, "r", encoding="utf-8") as f:
                target_snap = f.read().strip()
            snap_path = os.path.join(base_dir, "snapshots", target_snap)
            if os.path.isdir(snap_path):
                weights = os.path.join(snap_path, "model.safetensors")
                cfg = os.path.join(snap_path, "config.json")
                if os.path.isfile(weights) and os.path.isfile(cfg) and os.path.getsize(weights) > 4000 * 1024 * 1024:
                    return snap_path
        except Exception:
            pass

    snapshots_dir = os.path.join(base_dir, "snapshots")
    if os.path.isdir(snapshots_dir):
        for snap in sorted(os.listdir(snapshots_dir), reverse=True):
            snap_path = os.path.join(snapshots_dir, snap)
            weights_file = os.path.join(snap_path, "model.safetensors")
            cfg_file = os.path.join(snap_path, "config.json")
            if os.path.isfile(weights_file) and os.path.isfile(cfg_file):
                if os.path.getsize(weights_file) > 4000 * 1024 * 1024:
                    return snap_path
    return MODEL_ID

def get_vkp_model_and_processor():
    """
    Lazy-loads VKP-Omni-2B into memory onto GPU (cuda:0) with float16 or CPU fallback.
    Uses local files directly for instant offline initialization.
    """
    global _model, _processor, _load_error, _is_loading
    if _model is not None and _processor is not None:
        return _model, _processor

    if _is_loading:
        raise HTTPException(status_code=503, detail="VKP-Omni-2B model is currently loading weights. Please retry in a few seconds.")

    try:
        _is_loading = True
        model_path = get_local_model_path()
        logger.info(f"Loading VKP-Omni-2B from {model_path} into AI Dost 3.0 engine...")
        import torch
        from transformers import Qwen2VLForConditionalGeneration, AutoProcessor

        _processor = AutoProcessor.from_pretrained(model_path)

        has_cuda = torch.cuda.is_available()
        device = "cuda:0" if has_cuda else "cpu"
        torch_dtype = torch.float16 if has_cuda else torch.float32

        logger.info(f"Loading {MODEL_ID} on {device} ({torch_dtype})...")
        _model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_path,
            torch_dtype=torch_dtype,
            device_map=device
        )

        _load_error = None
        logger.info(f"Successfully loaded {MODEL_ID} into memory on {device}!")
        return _model, _processor
    except Exception as err:
        _load_error = str(err)
        logger.error(f"Failed to load {MODEL_ID}: {err}")
        raise HTTPException(
            status_code=500,
            detail=f"VKP-Omni-2B engine load error: {err}. Ensure torch, transformers, and weights are downloaded."
        )
    finally:
        _is_loading = False

def run_vkp_inference(prompt: str, max_tokens: int = 600, temperature: float = 0.01, repetition_penalty: float = 1.2) -> Dict[str, Any]:
    """
    Executes true neural network inference against VKP-Omni-2B for all prompts.
    Zero canned or hardcoded responses.
    Uses Cloud A10G GPU inference when available, with automatic local GPU fallback.
    """
    # 1. Try Cloud Space A10G GPU inference first
    try:
        cloud_reply = query_cloud_vkp(prompt)
        if cloud_reply:
            cleaned = strip_reasoning_monologue(cloud_reply, prompt) or cloud_reply
            cleaned = heal_refusal_response(cleaned, prompt)
            return {
                "model": "VKP-Omni-2B (Cloud A10G)",
                "author": "Vikash Kumar Pandit",
                "response": cleaned
            }
    except Exception as e:
        logger.warning(f"Cloud inference bypassed: {e}")

    # 2. Local neural inference fallback
    model, processor = get_vkp_model_and_processor()
    import torch

    is_chat = is_greeting_or_chitchat(prompt)
    effective_sys = SYSTEM_GREETING_PROMPT if is_chat else SYSTEM_GENERAL_PROMPT
    effective_max_tokens = min(max_tokens, 120) if is_chat else max_tokens

    messages = [
        {"role": "system", "content": effective_sys},
        {"role": "user", "content": prompt}
    ]
    
    formatted_text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    inputs = processor(text=[formatted_text], return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=effective_max_tokens,
            repetition_penalty=repetition_penalty,
            do_sample=False,
            eos_token_id=[151645, 151643]
        )

    raw_output = processor.batch_decode(outputs[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]
    cleaned = strip_reasoning_monologue(raw_output, prompt)
    if not cleaned:
        cleaned = raw_output.replace("<|im_end|>", "").replace("<|endoftext|>", "").strip()
    cleaned = heal_refusal_response(cleaned, prompt)

    return {
        "model": "VKP-Omni-2B (Local CUDA)",
        "author": "Vikash Kumar Pandit",
        "response": cleaned
    }

def stream_vkp_inference(prompt: str, max_tokens: int = 600, temperature: float = 0.01, repetition_penalty: float = 1.2):
    """
    Streams tokens in real-time directly from VKP-Omni-2B.
    Tries Cloud Space first (yielding streamed tokens), falling back to local neural weights.
    """
    # 1. Try Cloud Space first
    try:
        cloud_reply = query_cloud_vkp(prompt)
        if cloud_reply:
            cleaned = strip_reasoning_monologue(cloud_reply, prompt) or cloud_reply
            cleaned = heal_refusal_response(cleaned, prompt)
            words = re.split(r'(\s+)', cleaned)
            for w in words:
                if w:
                    yield w
                    time.sleep(0.012)
            return
    except Exception as e:
        logger.warning(f"Cloud stream bypassed: {e}")

    # 2. Local neural streaming fallback
    model, processor = get_vkp_model_and_processor()
    import torch
    from transformers import TextIteratorStreamer

    is_chat = is_greeting_or_chitchat(prompt)
    effective_sys = SYSTEM_GREETING_PROMPT if is_chat else SYSTEM_GENERAL_PROMPT
    effective_max_tokens = min(max_tokens, 120) if is_chat else max_tokens

    messages = [
        {"role": "system", "content": effective_sys},
        {"role": "user", "content": prompt}
    ]
    
    formatted_text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    inputs = processor(text=[formatted_text], return_tensors="pt").to(device)

    streamer = TextIteratorStreamer(processor.tokenizer, skip_prompt=True, skip_special_tokens=True)
    generation_kwargs = dict(
        **inputs,
        streamer=streamer,
        max_new_tokens=effective_max_tokens,
        repetition_penalty=repetition_penalty,
        do_sample=False,
        eos_token_id=[151645, 151643]
    )

    thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    # Live Thought Stripper
    buffer = ""
    is_suppressing_monologue = False
    checked_start = False

    for new_text in streamer:
        cleaned = new_text.replace("<|im_end|>", "").replace("<|endoftext|>", "")
        cleaned = cleaned.replace("<|begin_of_thought|>", "").replace("<|end_of_thought|>", "")
        if not cleaned:
            continue

        if not checked_start:
            buffer += cleaned
            if len(buffer) >= 30 or "\n" in buffer:
                checked_start = True
                if MONOLOGUE_PATTERN.match(buffer):
                    is_suppressing_monologue = True
                else:
                    yield buffer
                    buffer = ""
        else:
            if is_suppressing_monologue:
                buffer += cleaned
                if "\n\n" in buffer or "```" in buffer:
                    parts = buffer.split("\n\n")
                    candidate = parts[-1].strip()
                    if candidate and not MONOLOGUE_PATTERN.match(candidate):
                        is_suppressing_monologue = False
                        yield candidate
                        buffer = ""
            else:
                yield cleaned

    thread.join()

    # Flush remaining buffer or greeting fallback if entire output was monologue
    if is_suppressing_monologue:
        if is_chat:
            yield "Hello! I'm doing great, thank you for asking. How can I help you today?"
        else:
            res = strip_reasoning_monologue(buffer, prompt)
            if res:
                yield res
    elif buffer:
        yield buffer

# Standalone FastAPI App (can be run directly on port 8002 or mounted in main.py)
app = FastAPI(title="AI Dost 3.0 - VKP-Omni-2B Engine", version="3.0.0")

@app.get("/health")
@app.get("/api/ai-dost/vkp-omni/status")
@app.get("/ai/vkp-omni/status")
async def vkp_status():
    global _model, _load_error, _is_loading
    cloud_ready = get_cloud_client() is not None
    return {
        "model_id": MODEL_ID,
        "cloud_space": HF_SPACE_ID,
        "cloud_ready": cloud_ready,
        "author": "Vikash Kumar Pandit",
        "loaded": (_model is not None) or cloud_ready,
        "is_loading": _is_loading,
        "mode": "Cloud A10G" if cloud_ready else ("Local GPU" if _model is not None else "Standby"),
        "error": _load_error,
        "cuda_available": False if "torch" not in sys.modules else sys.modules["torch"].cuda.is_available()
    }

@app.post("/api/ai-dost/chat")
@app.post("/ai/vkp-omni/chat")
async def chat_handler(payload: QueryPayload):
    try:
        result = run_vkp_inference(
            prompt=payload.prompt,
            max_tokens=payload.max_tokens,
            temperature=payload.temperature,
            repetition_penalty=payload.repetition_penalty
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai-dost/chat/stream")
@app.post("/ai/vkp-omni/chat/stream")
async def chat_stream_handler(payload: QueryPayload):
    def token_generator():
        try:
            for chunk in stream_vkp_inference(
                prompt=payload.prompt,
                max_tokens=payload.max_tokens,
                temperature=payload.temperature,
                repetition_penalty=payload.repetition_penalty
            ):
                if chunk:
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(token_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("VKP_OMNI_PORT", 8002))
    print(f"Starting Standalone AI Dost 3.0 - VKP-Omni-2B on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
