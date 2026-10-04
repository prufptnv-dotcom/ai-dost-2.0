"""
AI-Dost AI Engine — Python FastAPI sidecar (port 8001).

Hosts Python-only AI capabilities that the Node.js backend cannot do natively:
  - LlamaIndex RAG: workspace files / documents par semantic Q&A
    (embeddings via local Ollama nomic-embed-text — free & offline)

Phase 2 (planned): LangGraph orchestration, CrewAI/AutoGen multi-agent runs.

Architecture:
  Frontend (Next.js) -> Backend (Node/Express :5000) -> AI Engine (FastAPI :8001)
"""

import asyncio
import ipaddress
import os
import shutil
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse, urljoin

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

# Global Checkpointer for HITL (initialized in lifespan)
agent_memory = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global agent_memory
    from langgraph.checkpoint.memory import MemorySaver
    agent_memory = MemorySaver()
    print("[AI-Dost] LangGraph MemorySaver initialized")
    yield


app = FastAPI(title="AI-Dost AI Engine", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def origin_guard(request: Request, call_next):
    # P0 FIX (#127): optional shared-secret auth. When AI_ENGINE_API_KEY is set,
    # every request must present it (X-API-Key header or Bearer token).
    api_key = os.environ.get("AI_ENGINE_API_KEY")
    if api_key and request.url.path not in ("/health", "/docs", "/openapi.json", "/redoc"):
        import hmac as _hmac
        provided = request.headers.get("x-api-key") or ""
        if not provided:
            auth_hdr = request.headers.get("authorization") or ""
            if auth_hdr[:7].lower() == "bearer ":
                provided = auth_hdr[7:].strip()
        if not provided or not _hmac.compare_digest(provided, api_key):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid X-API-Key"})

    if request.headers.get("sec-fetch-site", "").lower() == "cross-site":
        return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})
    origin = request.headers.get("origin")
    if origin:
        origin_host = (urlparse(origin).hostname or "").lower()
        req_host = (request.headers.get("host") or "").lower()
        if req_host.startswith("["):
            req_host = req_host[1:].split("]")[0]
        else:
            req_host = req_host.split(":")[0]
        # P2 FIX (#149): previously `not origin_host` allowed `Origin: null`,
        # `metadata.google.internal` was explicitly allowlisted, and ANY
        # private/link-local IP origin passed. Now: non-empty origin, same
        # host/localhost only, loopback IPs only.
        allowed = False
        if origin_host:
            allowed = (
                origin_host == req_host
                or origin_host == "localhost"
                or origin_host.endswith(".localhost")
            )
            if not allowed:
                try:
                    ip = ipaddress.ip_address(origin_host)
                    allowed = bool(ip.is_loopback)
                except ValueError:
                    allowed = False
        if not allowed:
            return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
    return await call_next(request)

# ── Load .env (backend/.env shared) so crew LLM keys work standalone ─────────
def _load_env():
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
    ]
    for env_path in candidates:
        try:
            if os.path.isfile(env_path):
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, _, val = line.partition("=")
                        key, val = key.strip(), val.strip().strip('"').strip("'")
                        if not os.environ.get(key):
                            os.environ[key] = val
        except Exception as e:
            # P3 #167: was a bare `except: pass` — a missing/misconfigured
            # secrets file failed silently at startup. Never log file contents.
            print(f"[AI-Dost] WARNING: could not load env file {env_path}: {type(e).__name__}: {e}", flush=True)

_load_env()
# Groq `cache_breakpoint` param reject karta hai — litellm ko drop karne do
if not os.environ.get("LITELLM_DROP_PARAMS"):
    os.environ["LITELLM_DROP_PARAMS"] = "true"

def _ollama_base_url() -> str:
    return os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")


def _ollama_alive() -> bool:
    try:
        import requests
        return requests.get(f"{_ollama_base_url()}/api/tags", timeout=2).status_code == 200
    except Exception:
        return False


# P2 FIX (#160): Chroma persistence was opened as CWD-relative "./chroma_db"
# in three places — launching uvicorn from any other directory silently pointed
# at a different/empty vector DB than start_ai_engine.bat. One absolute path.
CHROMA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")


# ── Lazy imports (so /health works even if llama-index is broken) ─────────────
def _llm():
    from llama_index.llms.ollama import Ollama
    try:
        return Ollama(model="qwen2.5-coder:7b", request_timeout=300.0, base_url=_ollama_base_url())
    except TypeError:
        return Ollama(model="qwen2.5-coder:7b", request_timeout=300.0)


def _embeddings():
    from llama_index.embeddings.ollama import OllamaEmbedding
    try:
        return OllamaEmbedding(model_name="nomic-embed-text", base_url=_ollama_base_url())
    except TypeError:
        return OllamaEmbedding(model_name="nomic-embed-text")


# P3 #165: dead code removed — `_load_nodes`, `INDEX_CACHE`, `_get_index`,
# `RagQuery` and `RagResult` were never referenced by any live route (old
# /ai/rag/query block was deleted by clean_main.py). `_get_index` also had the
# P3 #166 defect (deleted the Chroma collection BEFORE reloading nodes, so a
# load failure destroyed the previous index) — deleting the unreachable code
# fixes both. Live RAG uses get_learning_index()/rag_query below.


@app.get("/health")
def health():
    import importlib.util
    return {
        "status": "ok",
        "service": "ai-dost-ai-engine",
        "llama_index": importlib.util.find_spec("llama_index") is not None,
        "ollama_running": _ollama_alive(),
    }




class ScrapeRequest(BaseModel):
    url: str

class ScrapeResult(BaseModel):
    text: str
    url: str

def _validate_scrape_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Sirf http/https URLs scrape ho sakte hain")
    if os.environ.get("ALLOW_INTERNAL_SCRAPING", "").lower() in ("1", "true", "yes"):
        return
    host = (parsed.hostname or "").lower()
    if not host or host in ("localhost", "metadata.google.internal", "0.0.0.0") or host.endswith(".localhost"):
        raise HTTPException(400, "Internal/private URL scrape karna allowed nahi hai")
    # P3 #129: old check only handled literal IP strings — hostnames that
    # RESOLVE to private ranges (localhost.localdomain, nip.io, DNS rebind)
    # and alternate IP spellings (http://2130706433/) slipped through the
    # `except ValueError: return`. Resolve and check every address; reject
    # all-digit hosts outright.
    if host.isdigit():
        raise HTTPException(400, "Internal/private URL scrape karna allowed nahi hai")
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        import socket
        try:
            infos = socket.getaddrinfo(
                host, parsed.port or (443 if parsed.scheme == "https" else 80),
                proto=socket.IPPROTO_TCP,
            )
        except OSError:
            raise HTTPException(400, "URL ka host resolve nahi ho saka")
        addrs = {info[4][0] for info in infos}
        if not addrs:
            raise HTTPException(400, "URL ka host resolve nahi ho saka")
        for addr in addrs:
            try:
                resolved = ipaddress.ip_address(str(addr).split("%")[0])
            except ValueError:
                continue
            if not resolved.is_global:
                raise HTTPException(400, "Internal/private URL scrape karna allowed nahi hai")
        return
    if not ip.is_global:
        raise HTTPException(400, "Internal/private URL scrape karna allowed nahi hai")

_MAX_SCRAPE_BYTES = 5_000_000  # P3 #130

def _fetch_scrape_bytes(url: str) -> bytes:
    """P3 #128/#130: manual redirect loop (requests' auto-follow used to fetch
    302 targets like 169.254.169.254 WITHOUT validation) with a hard byte cap
    and connect/read timeouts so huge or slow-streaming pages cannot exhaust
    memory."""
    import requests
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    current = url
    for _hop in range(6):
        _validate_scrape_url(current)
        with requests.get(current, headers=headers, stream=True,
                           timeout=(5, 15), allow_redirects=False) as resp:
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location")
                if not location:
                    resp.raise_for_status()
                current = urljoin(current, location)
                continue
            resp.raise_for_status()
            buf = bytearray()
            for chunk in resp.iter_content(chunk_size=65536):
                if not chunk:
                    continue
                if len(buf) + len(chunk) > _MAX_SCRAPE_BYTES:
                    buf.extend(chunk[: _MAX_SCRAPE_BYTES - len(buf)])
                    break
                buf.extend(chunk)
            return bytes(buf)
    raise HTTPException(400, "Too many redirects (max 5)")

@app.post("/ai/research/scrape", response_model=ScrapeResult)
def scrape_url(req: ScrapeRequest):
    """Scrapes a URL and extracts clean text without relying on external APIs."""
    import requests
    from bs4 import BeautifulSoup
    _validate_scrape_url(req.url)
    try:
        content = _fetch_scrape_bytes(req.url)
        soup = BeautifulSoup(content, "html.parser")
        
        # Remove script and style tags
        for script_or_style in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            script_or_style.extract()
            
        text = soup.get_text(separator=' ')
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return ScrapeResult(text=text[:15000], url=req.url) # Limit text to prevent massive responses
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Scrape error: {e}")


# ------------------------------------------------------------------------------
# TAVILY WEB SEARCH — Real-time web search with sources
# ------------------------------------------------------------------------------
class TavilySearchRequest(BaseModel):
    query: str
    max_results: int = 5
    search_depth: str = "basic"  # basic | advanced
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None


class TavilySearchResult(BaseModel):
    query: str
    results: List[dict]
    answer: Optional[str] = None
    response_time: float


@app.post("/ai/web/search", response_model=TavilySearchResult)
def tavily_search(req: TavilySearchRequest):
    """Search the web using Tavily API. Returns structured results with sources."""
    import os
    import time
    import requests

    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise HTTPException(400, "TAVILY_API_KEY not set in environment")

    query = req.query.strip()
    if not query:
        raise HTTPException(400, "Query khali hai")

    # P2 FIX (#142): max_results/search_depth were forwarded raw to Tavily —
    # unbounded result counts burned quota and bad search_depth values surfaced
    # as opaque upstream 400s mapped to generic 500s.
    if req.max_results < 1 or req.max_results > 20:
        raise HTTPException(400, "max_results must be between 1 and 20")
    if req.search_depth not in ("basic", "advanced"):
        raise HTTPException(400, "search_depth must be 'basic' or 'advanced'")

    start_time = time.time()
    try:
        url = "https://api.tavily.com/search"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "query": query,
            "max_results": req.max_results,
            "search_depth": req.search_depth,
            "include_answer": True,
            "include_raw_content": False,
        }
        if req.include_domains:
            payload["include_domains"] = req.include_domains
        if req.exclude_domains:
            payload["exclude_domains"] = req.exclude_domains

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        results = data.get("results", [])
        formatted = []
        for r in results:
            formatted.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:500],
                "score": r.get("score", 0),
            })

        return TavilySearchResult(
            query=query,
            results=formatted,
            answer=data.get("answer"),
            response_time=time.time() - start_time
        )
    except requests.HTTPError as e:
        if e.response.status_code == 429:
            raise HTTPException(429, "Tavily rate limit exceeded")
        raise HTTPException(500, f"Tavily API error: {e}")
    except Exception as e:
        raise HTTPException(500, f"Tavily search error: {e}")


class AgentRunRequest(BaseModel):
    thread_id: str
    prompt: str
    # mcp_command/mcp_args deprecated — client-supplied process spawn ignored; server-side MCP_COMMAND env only

# P2 FIX (#146): the fallback read_file tool returned fabricated
# "Mock content of <path>" for ANY path — the agent then acted on invented
# data. Real reads only, rooted at an engine-controlled directory (env
# override AI_ENGINE_FILE_ROOT), with traversal containment + size cap.
AI_ENGINE_FILE_ROOT = os.path.realpath(
    os.environ.get("AI_ENGINE_FILE_ROOT") or os.path.dirname(os.path.abspath(__file__))
)
_MAX_READ_CHARS = 200000


def _safe_read_file(path: str) -> str:
    try:
        real = os.path.realpath(os.path.join(AI_ENGINE_FILE_ROOT, str(path)))
        if real != AI_ENGINE_FILE_ROOT and not real.startswith(AI_ENGINE_FILE_ROOT + os.sep):
            return f"ERROR: path is outside the allowed root ({AI_ENGINE_FILE_ROOT})"
        if not os.path.isfile(real):
            return f"ERROR: file not found: {path}"
        with open(real, "r", encoding="utf-8", errors="replace") as fh:
            data = fh.read(_MAX_READ_CHARS)
        if len(data) >= _MAX_READ_CHARS:
            data += "\n... [truncated at 200000 chars]"
        return data
    except Exception as e:
        return f"ERROR: {e}"

class AgentRunResult(BaseModel):
    status: str
    result: str = ""
    tool_call: Optional[dict] = None
    # P3 #135: single-use capability token minted on requires_approval;
    # /ai/agent/resume must echo it back for that thread.
    resume_token: Optional[str] = None


def _server_mcp_config():
    command = os.environ.get("MCP_COMMAND", "").strip()
    if not command:
        return None
    import shlex
    return command, shlex.split(os.environ.get("MCP_ARGS", ""))

# ── P3 #134/#135: thread validation + resume capability tokens ───────────────
# thread_id is client-supplied and the MemorySaver checkpointer is shared
# process-wide — without a token, any caller who could reach /ai/agent/resume
# could approve/pollute another session's pending interrupt. Each
# requires_approval response mints a token bound to that thread; resume must
# present it. (End-user ownership is additionally enforced by the Node
# backend; the engine sees only its own callers.)
import re as _re
import secrets as _secrets
import time as _time

_PENDING_RESUMES = {}
_PENDING_TTL_S = 3600
_THREAD_ID_RE = _re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
# P3 #170: in-process TTS throttle (10/60s) — main.py has no rate limiter and
# edge_tts is a free shared upstream.
_TTS_RATE = {"times": [], "window": 60.0, "max": 10, "lock": threading.Lock()}

def _validate_thread_id(thread_id: str) -> str:
    tid = str(thread_id or "")
    if not _THREAD_ID_RE.match(tid):
        raise HTTPException(400, "Invalid thread_id (allowed: A-Z a-z 0-9 . _ : - , max 128 chars)")
    return tid

def _issue_resume_token(thread_id: str) -> str:
    now = _time.time()
    # keep only the newest token per thread + drop expired ones
    for tok, entry in list(_PENDING_RESUMES.items()):
        if entry["thread_id"] == thread_id or now - entry["created_at"] > _PENDING_TTL_S:
            _PENDING_RESUMES.pop(tok, None)
    tok = _secrets.token_urlsafe(24)
    _PENDING_RESUMES[tok] = {"thread_id": thread_id, "created_at": now}
    return tok

def _require_resume_token(token: str, thread_id: str) -> None:
    key = str(token or "")
    entry = _PENDING_RESUMES.get(key)
    if not entry or entry["thread_id"] != thread_id:
        raise HTTPException(403, "Valid resume_token required (call /ai/agent/run first and use its resume_token)")
    if _time.time() - entry["created_at"] > _PENDING_TTL_S:
        _PENDING_RESUMES.pop(key, None)
        raise HTTPException(403, "resume_token expired")

@app.post("/ai/agent/run", response_model=AgentRunResult)
async def agent_run(req: AgentRunRequest):
    from mcp_client import MCPClientManager
    from langchain_ollama import ChatOllama
    from langgraph.prebuilt import create_react_agent

    req.thread_id = _validate_thread_id(req.thread_id)  # P3 #135 (outside try — 400 not wrapped as 500)
    mcp_manager = None
    try:
        tools = []
        mcp_cfg = _server_mcp_config()
        if mcp_cfg:
            mcp_manager = MCPClientManager(command=mcp_cfg[0], args=mcp_cfg[1])
            tools = await mcp_manager.get_langchain_tools()
        else:
            from langchain_core.tools import tool
            @tool
            def read_file(path: str) -> str:
                """Read content of a file inside the engine's allowed root."""
                return _safe_read_file(path)
            
            tools = [read_file, create_new_tool] + load_custom_tools()

        llm = ChatOllama(model="qwen2.5-coder:7b", temperature=0.1, base_url=_ollama_base_url())
        
        # Use checkpointer and interrupt_before tools for HITL
        
        # Retrieve past learnings
        try:
            learning_index = get_learning_index()
            retriever = learning_index.as_retriever(similarity_top_k=2)
            # P2 #138: blocking embedding I/O must not run on the event loop
            learning_nodes = await asyncio.to_thread(retriever.retrieve, req.prompt)
            learnings_text = "\n".join([n.get_content() for n in learning_nodes])
            system_prompt = f"Relevant Past Learnings:\n{learnings_text}\n\nYou are a helpful AI Assistant."
        except Exception:
            system_prompt = "You are a helpful AI Assistant."
            
        agent_executor = create_react_agent(llm, tools, checkpointer=agent_memory, interrupt_before=["tools"], state_modifier=system_prompt)

        config = {"configurable": {"thread_id": req.thread_id}}
        
        response = await agent_executor.ainvoke({"messages": [("user", req.prompt)]}, config)
        
        # P2 #138: sync LangGraph state read off the event loop
        state = await asyncio.to_thread(agent_executor.get_state, config)
        if state.next:
            # Interrupted before tool execution
            last_message = response["messages"][-1]
            tool_call = last_message.tool_calls[0] if hasattr(last_message, "tool_calls") and last_message.tool_calls else None
            # P3 #135: mint the capability token resume must present
            return AgentRunResult(status="requires_approval", tool_call=tool_call,
                                  resume_token=_issue_resume_token(req.thread_id))
            
        final_answer = response["messages"][-1].content
        return AgentRunResult(status="completed", result=final_answer)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Agent run error: {e}")
    finally:
        if mcp_manager is not None:
            try:
                await mcp_manager.close()
            except Exception:
                pass

class AgentResumeRequest(BaseModel):
    thread_id: str
    approved: bool
    prompt: str = ""
    # P3 #135: capability token minted by the requires_approval response
    resume_token: str = ""
    # mcp_command/mcp_args deprecated — ignored; server-side MCP_COMMAND env only

@app.post("/ai/agent/resume", response_model=AgentRunResult)
async def agent_resume(req: AgentResumeRequest):
    from mcp_client import MCPClientManager
    from langchain_ollama import ChatOllama
    from langgraph.prebuilt import create_react_agent
    from langchain_core.messages import ToolMessage

    # P3 #135: validation outside try so 400/403 aren't re-wrapped as 500
    req.thread_id = _validate_thread_id(req.thread_id)
    _require_resume_token(req.resume_token, req.thread_id)

    mcp_manager = None
    try:
        tools = []
        mcp_cfg = _server_mcp_config()
        if mcp_cfg:
            mcp_manager = MCPClientManager(command=mcp_cfg[0], args=mcp_cfg[1])
            tools = await mcp_manager.get_langchain_tools()
        else:
            from langchain_core.tools import tool
            @tool
            def read_file(path: str) -> str:
                """Read content of a file inside the engine's allowed root."""
                return _safe_read_file(path)
            
            tools = [read_file, create_new_tool] + load_custom_tools()

        llm = ChatOllama(model="qwen2.5-coder:7b", temperature=0.1, base_url=_ollama_base_url()) 
        
        
        # Retrieve past learnings (resume stored context se — prompt optional)
        try:
            system_prompt = "You are a helpful AI Assistant."
            if req.prompt:
                learning_index = get_learning_index()
                retriever = learning_index.as_retriever(similarity_top_k=2)
                # P2 #138: blocking embedding I/O off the event loop
                learning_nodes = await asyncio.to_thread(retriever.retrieve, req.prompt)
                learnings_text = "\n".join([n.get_content() for n in learning_nodes])
                system_prompt = f"Relevant Past Learnings:\n{learnings_text}\n\nYou are a helpful AI Assistant."
        except Exception:
            system_prompt = "You are a helpful AI Assistant."
            
        agent_executor = create_react_agent(llm, tools, checkpointer=agent_memory, interrupt_before=["tools"], state_modifier=system_prompt)

        config = {"configurable": {"thread_id": req.thread_id}}
        
        if req.approved:
            # P3 #134: unknown/finished threads get a clear 404 instead of an
            # opaque ainvoke failure inside the generic 500 handler.
            state = await asyncio.to_thread(agent_executor.get_state, config)
            if not (state.values or {}).get("messages"):
                raise HTTPException(404, "Unknown or empty thread — nothing to resume")
            # Continue execution by invoking with None
            response = await agent_executor.ainvoke(None, config)
        else:
            # Inject a ToolMessage indicating denial to skip actual tool execution
            # P2 #138: sync LangGraph state read off the event loop
            state = await asyncio.to_thread(agent_executor.get_state, config)
            # P3 #134: the old `state.values["messages"][-1]` +
            # `last_msg.tool_calls[0]["id"]` threw IndexError/TypeError → opaque
            # 500 for unknown threads or threads with no pending tool call.
            messages = (state.values or {}).get("messages") or []
            if not messages:
                raise HTTPException(404, "Unknown or empty thread — nothing to resume")
            last_msg = messages[-1]
            tool_calls = getattr(last_msg, "tool_calls", None) or []
            if not tool_calls:
                raise HTTPException(409, "No pending tool call for this thread — nothing to resume")
            tc = tool_calls[0]
            tool_call_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
            tool_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "")
            if not tool_call_id:
                raise HTTPException(409, "Pending tool call has no id — cannot resume")
            denial_msg = ToolMessage(tool_call_id=tool_call_id, name=tool_name, content="User denied this action.")
            
            # Update state with the denial message to bypass the tool node
            # P2 #138: sync LangGraph state write off the event loop
            await asyncio.to_thread(
                agent_executor.update_state, config, {"messages": [denial_msg]}, as_node="tools"
            )
            
            # Resume from after the tool node
            response = await agent_executor.ainvoke(None, config)
            
        # P2 #138: sync LangGraph state read off the event loop
        state = await asyncio.to_thread(agent_executor.get_state, config)
        if state.next:
            last_message = response["messages"][-1]
            tool_call = last_message.tool_calls[0] if hasattr(last_message, "tool_calls") and last_message.tool_calls else None
            # P3 #135: re-interrupt → fresh token replaces the consumed one
            return AgentRunResult(status="requires_approval", tool_call=tool_call,
                                  resume_token=_issue_resume_token(req.thread_id))
        # P3 #135: run finished — invalidate the token that got us here
        _PENDING_RESUMES.pop(str(req.resume_token), None)
        final_answer = response["messages"][-1].content
        return AgentRunResult(status="completed", result=final_answer)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Agent resume error: {e}")
    finally:
        if mcp_manager is not None:
            try:
                await mcp_manager.close()
            except Exception:
                pass





# ------------------------------------------------------------------------------
# DYNAMIC TOOLS (Self-Evolution)
# ------------------------------------------------------------------------------
import re
import sys
import importlib.util
from langchain_core.tools import tool

CUSTOM_TOOLS_DIR = os.path.join(os.path.dirname(__file__), "custom_tools")
os.makedirs(CUSTOM_TOOLS_DIR, exist_ok=True)

ENABLE_CUSTOM_TOOLS = os.environ.get("ENABLE_CUSTOM_TOOLS", "").lower() in ("1", "true", "yes")
_CUSTOM_TOOL_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_CUSTOM_TOOL_BLOCKLIST = ("os.system", "subprocess", "__import__", "eval(", "exec(")

# P0 FIX (#131): substring denylists are bypassable (os.popen, open, eval (,
# __builtins__ tricks). Replace with AST validation — import allowlist +
# denied call/name list + dunder-attribute ban.
import ast as _ast
_ALLOWED_TOOL_IMPORTS = {
    "langchain_core", "typing", "re", "json", "math", "datetime", "date",
    "time", "collections", "itertools", "functools", "string", "random",
    "statistics", "decimal", "textwrap", "unicodedata", "hashlib", "base64",
    "uuid", "copy", "enum", "dataclasses", "pprint", "difflib",
}
_DENIED_TOOL_NAMES = {
    # builtins that enable code exec / file IO / reflection — denied as bare
    # names (any reference, not just calls, so aliasing cannot bypass)
    "eval", "exec", "compile", "__import__", "open", "input", "breakpoint",
    "globals", "locals", "vars", "getattr", "setattr", "delattr", "memoryview",
    "exit", "quit", "__builtins__",
}
# dangerous attribute-style calls (would need a banned import to exist anyway;
# listed defensively against allowlist drift)
_DENIED_ATTR_CALLS = {
    "system", "popen", "Popen", "check_output", "check_call", "check_return",
    "spawn", "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve",
    "spawnvp", "spawnvpe", "fork", "forkpty", "rmtree",
}


def _validate_custom_tool_code(python_code: str):
    """Return an error string if the code is unsafe, else None."""
    try:
        tree = _ast.parse(python_code)
    except SyntaxError as e:
        return f"Error: python_code ka syntax invalid hai ({e})."
    for node in _ast.walk(tree):
        if isinstance(node, _ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in _ALLOWED_TOOL_IMPORTS:
                    return f"Error: import '{alias.name}' allowed nahi hai."
        elif isinstance(node, _ast.ImportFrom):
            if node.level and node.level > 0:
                return "Error: relative imports allowed nahi hain."
            root = (node.module or "").split(".")[0]
            if root not in _ALLOWED_TOOL_IMPORTS:
                return f"Error: import 'from {node.module}' allowed nahi hai."
        elif isinstance(node, _ast.Call):
            if isinstance(node.func, _ast.Name):
                if node.func.id in _DENIED_TOOL_NAMES:
                    return f"Error: call to '{node.func.id}' blocked hai."
            elif isinstance(node.func, _ast.Attribute):
                if node.func.attr in _DENIED_ATTR_CALLS:
                    return f"Error: call to '.{node.func.attr}()' blocked hai."
        elif isinstance(node, _ast.Name):
            if node.id in _DENIED_TOOL_NAMES:
                return f"Error: '{node.id}' use karna blocked hai."
        elif isinstance(node, _ast.Attribute):
            if node.attr.startswith("__") and node.attr.endswith("__"):
                return f"Error: dunder attribute '{node.attr}' blocked hai."
    return None

@tool
def create_new_tool(tool_name: str, python_code: str) -> str:
    """
    Use this tool to create a NEW capability for yourself!
    Provide the exact Python code. The code MUST contain exactly ONE function decorated with @tool.
    Example python_code:
    from langchain_core.tools import tool
    @tool
    def my_new_tool(text: str) -> str:
        '''Description of tool'''
        return text.upper()
    """
    if not ENABLE_CUSTOM_TOOLS:
        return "Error: custom tools disabled hai — ENABLE_CUSTOM_TOOLS=1 set karke server restart karo."
    if not _CUSTOM_TOOL_NAME_RE.match(tool_name):
        return "Error: invalid tool_name — sirf letters, digits aur underscore use karo (digit se shuru mat karo)."
    code_l = python_code.lower()
    if any(bad in code_l for bad in _CUSTOM_TOOL_BLOCKLIST):
        return "Error: python_code blocked pattern contain karta hai (os.system/subprocess/eval/exec/__import__)."
    # P0 FIX (#131): AST-level validation — imports allowlisted, dangerous
    # names/calls and dunder access rejected (substring checks were bypassable).
    ast_error = _validate_custom_tool_code(python_code)
    if ast_error:
        return ast_error
    try:
        # Save to disk
        filepath = os.path.join(CUSTOM_TOOLS_DIR, f"{tool_name}.py")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(python_code)
        return f"Success! Tool '{tool_name}' saved to {filepath}. It will be available in the next agent run."
    except Exception as e:
        return f"Failed to create tool: {e}"

def load_custom_tools():
    """Dynamically loads all .py files in custom_tools as Langchain tools."""
    loaded_tools = []
    if not ENABLE_CUSTOM_TOOLS or not os.path.exists(CUSTOM_TOOLS_DIR):
        return loaded_tools
        
    for filename in os.listdir(CUSTOM_TOOLS_DIR):
        if filename.endswith(".py"):
            filepath = os.path.join(CUSTOM_TOOLS_DIR, filename)
            base_name = filename[:-3]
            # P0 FIX (#132): never register raw filename as module name — a tool
            # named json.py/os.py would otherwise OVERWRITE the stdlib module
            # process-wide. Namespace it and skip invalid identifiers.
            if not _CUSTOM_TOOL_NAME_RE.match(base_name):
                continue
            module_name = f"_customtool_{base_name}"
            try:
                spec = importlib.util.spec_from_file_location(module_name, filepath)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[module_name] = module
                    spec.loader.exec_module(module)
                    
                    # Find the tool in the module (assuming it has a 'name' attribute or is a Langchain BaseTool)
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if hasattr(attr, "name") and hasattr(attr, "description") and callable(attr):
                            # Usually a LangChain tool instance
                            loaded_tools.append(attr)
            except Exception as e:
                print(f"Error loading custom tool {filename}: {e}")
    return loaded_tools


# ------------------------------------------------------------------------------
# LONG-TERM MEMORY (Continuous Learning)
# ------------------------------------------------------------------------------

class MemoryLearnRequest(BaseModel):
    text: str
    
class MemoryRetrieveRequest(BaseModel):
    query: str
    top_k: int = 3

def get_learning_index():
    import chromadb
    from llama_index.vector_stores.chroma import ChromaVectorStore
    from llama_index.core import VectorStoreIndex, StorageContext

    # P2 FIX (#155): no dummy seed document. The old "Initial rule" doc was
    # returned by EVERY memory query (pollution for all users/threads), and
    # the count()==0 check-then-insert raced under concurrent first calls.
    # An empty store simply has no learnings; save_memory's insert
    # initializes it — no seed, no race. (P2 #160: absolute CHROMA_DIR
    # instead of CWD-relative "./chroma_db".)
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    chroma_collection = chroma_client.get_or_create_collection("agent_learnings")
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    return VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=_embeddings(),
    )

@app.post("/ai/agent/learn")
async def save_memory(req: MemoryLearnRequest):
    from llama_index.core import Document

    def _save():
        index = get_learning_index()
        index.insert(Document(text=req.text))

    try:
        # P2 #138: chroma open + embedding insert run in a worker thread so
        # the event loop (health/TTS/agents) never blocks on memory I/O.
        await asyncio.to_thread(_save)
        return {"status": "success", "message": "Memory saved!"}
    except Exception as e:
        raise HTTPException(500, f"Error saving memory: {e}")

@app.post("/ai/agent/memory/retrieve")
async def retrieve_memory(req: MemoryRetrieveRequest):
    # P2 FIX (#141): top_k was passed straight to similarity_top_k —
    # 0/-5/10**7 produced broken or resource-exhausting retrieval queries.
    if req.top_k < 1 or req.top_k > 50:
        raise HTTPException(400, "top_k must be between 1 and 50")

    def _retrieve():
        # P2 FIX (#155): never-used memory store = no learnings. Check the
        # count before querying (some chroma versions reject n_results > count)
        # instead of seeding a fake document that polluted every retrieval.
        import chromadb
        col = chromadb.PersistentClient(path=CHROMA_DIR).get_or_create_collection("agent_learnings")
        if col.count() == 0:
            return []
        index = get_learning_index()
        retriever = index.as_retriever(similarity_top_k=req.top_k)
        return [n.get_content() for n in retriever.retrieve(req.query)]

    try:
        # P2 #138: blocking embedding/chroma I/O off the event loop.
        results = await asyncio.to_thread(_retrieve)
        return {"status": "success", "learnings": results}
    except Exception as e:
        raise HTTPException(500, f"Error retrieving memory: {e}")


# ------------------------------------------------------------------------------
# MULTI-AGENT SWARM (CrewAI-Style via LangGraph System Prompts)
# ------------------------------------------------------------------------------
class SwarmRunRequest(BaseModel):
    thread_id: str
    prompt: str
    # mcp_command/mcp_args deprecated — ignored; server-side MCP_COMMAND env only

@app.post("/ai/agent/swarm", response_model=AgentRunResult)
async def swarm_run(req: SwarmRunRequest):
    from mcp_client import MCPClientManager
    from langchain_ollama import ChatOllama
    from langgraph.prebuilt import create_react_agent

    req.thread_id = _validate_thread_id(req.thread_id)  # P3 #135 (outside try)
    mcp_manager = None
    try:
        tools = []
        mcp_cfg = _server_mcp_config()
        if mcp_cfg:
            mcp_manager = MCPClientManager(command=mcp_cfg[0], args=mcp_cfg[1])
            tools = await mcp_manager.get_langchain_tools()
        else:
            from langchain_core.tools import tool
            @tool
            def read_file(path: str) -> str:
                """Read content of a file inside the engine's allowed root."""
                return _safe_read_file(path)
            
            tools = [read_file, create_new_tool] + load_custom_tools()

            
        llm = ChatOllama(model="qwen2.5-coder:7b", temperature=0.1, base_url=_ollama_base_url()) 
        
        # Swarm System Prompt
        
        # Retrieve past learnings
        try:
            learning_index = get_learning_index()
            retriever = learning_index.as_retriever(similarity_top_k=2)
            # P2 #138: blocking embedding I/O off the event loop
            learning_nodes = await asyncio.to_thread(retriever.retrieve, req.prompt)
            learnings_text = "\n".join([n.get_content() for n in learning_nodes])
            past_context = f"Relevant Past Learnings:\n{learnings_text}\n\n"
        except Exception:
            past_context = ""
            
        swarm_prompt = past_context + """You are the Swarm Manager. You control a team of agents: Researcher, Coder, and Tester.
        You must tackle the user's task by simulating this team.
        1. First, act as the Researcher to gather information using tools.
        2. Then, act as the Coder to write the necessary files.
        3. Finally, act as the Tester to review and verify the files.
        Always state which role you are currently playing in your thought process (e.g. '[Coder]: Writing the file...').
        """
        
        agent_executor = create_react_agent(llm, tools, checkpointer=agent_memory, interrupt_before=["tools"], state_modifier=swarm_prompt)
        config = {"configurable": {"thread_id": req.thread_id}}
        
        response = await agent_executor.ainvoke({"messages": [("user", req.prompt)]}, config)
        
        # P2 #138: sync LangGraph state read off the event loop
        state = await asyncio.to_thread(agent_executor.get_state, config)
        if state.next:
            last_message = response["messages"][-1]
            tool_call = last_message.tool_calls[0] if hasattr(last_message, "tool_calls") and last_message.tool_calls else None
            # P3 #135: swarm interrupts also require a resume token
            return AgentRunResult(status="requires_approval", tool_call=tool_call,
                                  resume_token=_issue_resume_token(req.thread_id))

        final_answer = response["messages"][-1].content
        return AgentRunResult(status="completed", result=final_answer)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Swarm run error: {e}")
    finally:
        if mcp_manager is not None:
            try:
                await mcp_manager.close()
            except Exception:
                pass


# ------------------------------------------------------------------------------
# CREWAI MULTI-AGENT CREW (Pillar 1: Agentic Core — role-based collaboration)
# ------------------------------------------------------------------------------
class CrewRunRequest(BaseModel):
    prompt: str
    mode: str = "dev"          # dev | research | content
    model: str = "ollama"      # ollama (free/local) | gemini | groq | nvidia | cerebras
    directory: str = ""

class CrewRunResult(BaseModel):
    status: str
    result: str = ""
    crew_output: str = ""
    agents: List[str] = []
    files: List[str] = []
    directory: str = ""

def _resolve_work_dir(directory: str) -> str:
    base = Path(os.environ.get("AI_ENGINE_WORKSPACE") or (Path.cwd() / "workspaces")).resolve()
    target = (base / directory).resolve() if directory else (base / "default")
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(400, "Directory workspace base ke bahar hai")
    return str(target)


# P2 FIX (#139): CrewAI kickoff() runs for minutes on the sync route inside
# FastAPI's ~40-thread anyio pool — unbounded parallel crews exhausted the
# pool and took the whole service down (health/TTS/xlsx all starved). Cap
# concurrency; extra requests wait briefly then get an honest 429.
_CREW_SLOTS = threading.BoundedSemaphore(
    2 if not str(os.environ.get("AI_ENGINE_CREW_MAX_CONCURRENCY", "2")).strip().isdigit()
    else max(1, int(os.environ.get("AI_ENGINE_CREW_MAX_CONCURRENCY", "2")))
)
try:
    _CREW_QUEUE_TIMEOUT = max(0.0, float(os.environ.get("AI_ENGINE_CREW_QUEUE_TIMEOUT", "15")))
except ValueError:
    _CREW_QUEUE_TIMEOUT = 15.0


@app.post("/ai/crew/run", response_model=CrewRunResult)
def crew_run(req: CrewRunRequest):
    """Slot-guarded entry point — actual work in _crew_run_locked (P2 #139)."""
    if not _CREW_SLOTS.acquire(timeout=_CREW_QUEUE_TIMEOUT):
        raise HTTPException(429, "Crew slots busy — thoda baad me retry karo")
    try:
        return _crew_run_locked(req)
    finally:
        _CREW_SLOTS.release()


def _crew_run_locked(req: CrewRunRequest) -> CrewRunResult:
    """Run a real CrewAI role-based crew (Researcher + Coder + Reviewer).

    Free & offline by default: Ollama qwen2.5-coder:7b local LLM.
    Modes:
      - dev:      Researcher(analyze) -> Coder(write) -> Reviewer(verify)
      - research: Researcher(gather) -> Writer(summarize)
      - content:  Writer(draft) -> Reviewer(polish)
    """
    try:
        from crewai import Agent, Task, Crew, Process
        from crewai.tools import tool

        # Groq `cache_breakpoint` support nahi karta — marker no-op bana do
        try:
            import crewai.llms.cache as _cache_mod
            _cache_mod.mark_cache_breakpoint = lambda msg: msg
        except Exception:
            pass

        prompt = req.prompt.strip()
        if not prompt:
            raise HTTPException(400, "Prompt khali hai")

        # P2 FIX (#147): unknown model/mode silently fell through to the
        # Ollama/dev else-branches — validate the contract with a 400 instead.
        if req.model not in ("ollama", "gemini", "groq", "nvidia", "cerebras"):
            raise HTTPException(
                400,
                f"Unknown model '{req.model}' — allowed: ollama, gemini, groq, nvidia, cerebras",
            )
        if req.mode not in ("dev", "research", "content"):
            raise HTTPException(
                400, f"Unknown mode '{req.mode}' — allowed: dev, research, content"
            )

        work_dir = _resolve_work_dir(req.directory)
        if not os.path.isdir(work_dir):
            try:
                os.makedirs(work_dir, exist_ok=True)
            except Exception:
                pass

        # ── Custom file tools (CrewAI 1.15 ke paas built-in file tools nahi) ──
        @tool("save_project_file")
        def save_project_file(filename: str, content: str) -> str:
            """Create or overwrite a file inside the project workspace.
            filename ek relative path hota hai (jaise 'src/app.py' ya 'index.html').
            Content pura file content hota hai."""
            # P3 #171: only traversal is dangerous — the old blanket
            # `startswith((".", "/", "\\"))` rejected legitimate dotfiles
            # (.gitignore, .env.example) so they could never be created.
            if not filename or filename.startswith(("/", "\\")):
                return "Error: invalid filename — sirf relative path do (jaise 'src/app.py')."
            safe_name = filename.replace("\\", "/").strip()
            parts = [p for p in safe_name.split("/") if p not in ("", ".")]
            if not parts or any(p == ".." for p in parts):
                return "Error: invalid filename — sirf relative path do (jaise 'src/app.py')."
            safe_name = "/".join(parts)
            target = os.path.abspath(os.path.join(work_dir, safe_name))
            if os.path.commonpath([target, os.path.abspath(work_dir)]) != os.path.abspath(work_dir):
                return "Error: path workspace ke bahar jata hai."
            try:
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "w", encoding="utf-8") as f:
                    f.write(content)
                return f"File save ho gayi: {safe_name}"
            except Exception as e:
                return f"Error: {e}"

        @tool("list_project_files")
        def list_project_files(query: str = "") -> str:
            """List files available in the project workspace.
            query optional hota hai — case-insensitive substring filter lag jata hai."""
            try:
                out = []
                # P2 FIX (#157): `query` was documented as a filter but never
                # read — always returned the first 100 walked files.
                q = (query or "").strip().lower()
                for root, _dirs, files in os.walk(work_dir):
                    for f in files:
                        if f.startswith(".") or "node_modules" in root or ".git" in root:
                            continue
                        rel = os.path.relpath(os.path.join(root, f), work_dir)
                        if q and q not in rel.lower():
                            continue
                        out.append(rel)
                out.sort()
                return "\n".join(out[:100]) or "(workspace me aisa kuch nahi mila)"
            except Exception as e:
                return f"Error: {e}"

        # ── LLM choice (API keys .env se load ho jate hain startup pe) ──
        from crewai.llm import LLM
        if req.model == "gemini":
            key = os.environ.get("GEMINI_API_KEY", "")
            if not key:
                raise HTTPException(400, "GEMINI_API_KEY set nahi hai")
            llm = LLM(model="gemini/gemini-2.5-flash")
        elif req.model == "groq":
            key = os.environ.get("GROQ_API_KEY", "")
            if not key:
                raise HTTPException(400, "GROQ_API_KEY set nahi hai")
            llm = LLM(model="groq/llama-3.3-70b-versatile", additional_params={"drop_params": True})
        elif req.model == "nvidia":
            key = os.environ.get("NVIDIA_API_KEY", "")
            if not key:
                raise HTTPException(400, "NVIDIA_API_KEY set nahi hai")
            llm = LLM(model="openai/meta/llama-3.1-8b-instruct", api_key=key, api_base="https://integrate.api.nvidia.com/v1")
            # NVIDIA single tool-call support karta — ReAct path use karo (sequential tool calls)
            llm.supports_function_calling = lambda: False
        elif req.model == "cerebras":
            key = os.environ.get("CEREBRAS_API_KEY", "")
            if not key:
                raise HTTPException(400, "CEREBRAS_API_KEY set nahi hai — cerebras.ai/cloud se free key lo")
            llm = LLM(model="cerebras/gpt-oss-120b")
        else:
            llm = LLM(model="ollama/qwen2.5-coder:7b")

        if req.mode == "research":
            researcher = Agent(
                role="Senior Researcher",
                goal=f"Deeply research: {prompt}. Use list_project_files tool aur available files ki context.",
                backstory="You are a meticulous researcher who finds facts, sources and structured insights.",
                llm=llm, verbose=False, allow_delegation=False, tools=[list_project_files],
            )
            writer = Agent(
                role="Technical Writer",
                goal="Turn raw research into a clear, structured, well-written summary/report. Use save_project_file to save the report as a .md file.",
                backstory="You write crisp, professional summaries with headings and bullet points.",
                llm=llm, verbose=False, allow_delegation=False, tools=[save_project_file],
            )
            t1 = Task(
                description=f"Research the topic: {prompt}. Use list_project_files to see workspace files. Return raw findings with key facts and sources.",
                expected_output="Structured research findings with facts and sources.",
                agent=researcher,
            )
            t2 = Task(
                description="Write a final clean report from the research findings. Use headings, bullets, and a summary.",
                expected_output="A polished markdown report.",
                agent=writer,
            )
            agents = [researcher, writer]
        elif req.mode == "content":
            writer = Agent(
                role="Content Writer",
                goal=f"Create engaging content about: {prompt}. Use save_project_file to save the draft as a .md file.",
                backstory="You craft compelling, human-sounding articles and scripts.",
                llm=llm, verbose=False, allow_delegation=False, tools=[save_project_file],
            )
            editor = Agent(
                role="Content Editor",
                goal="Polish the draft: fix grammar, tighten wording, improve flow and structure. Save final version with save_project_file.",
                backstory="You are a sharp editor who makes good content great.",
                llm=llm, verbose=False, allow_delegation=False, tools=[save_project_file],
            )
            t1 = Task(
                description=f"Write a first draft (article/script) about: {prompt}. Use list_project_files for workspace context.",
                expected_output="A complete first draft.",
                agent=writer,
            )
            t2 = Task(
                description="Edit the draft for clarity, grammar, flow and impact. Return the final polished version.",
                expected_output="Final polished content.",
                agent=editor,
            )
            agents = [writer, editor]
        else:  # dev mode (default)
            researcher = Agent(
                role="Codebase Researcher",
                goal=f"Analyze the request and existing workspace using list_project_files: {prompt}. Determine what files/code are needed.",
                backstory="You inspect requirements and existing files to plan exact implementation steps.",
                llm=llm, verbose=False, allow_delegation=False, tools=[list_project_files],
            )
            coder = Agent(
                role="Senior Software Engineer",
                goal="Write complete, working, production-quality code implementing the research plan. MUST use save_project_file to actually create the files in the workspace.",
                backstory="You are a full-stack engineer who writes clean, correct code and saves every file with the save_project_file tool.",
                llm=llm, verbose=False, allow_delegation=False, tools=[save_project_file, list_project_files],
            )
            reviewer = Agent(
                role="Code Reviewer",
                goal="Review the code for bugs, security issues and completeness. List fixes and final answer.",
                backstory="You are a meticulous reviewer who catches edge cases before they ship.",
                llm=llm, verbose=False, allow_delegation=False,
            )
            t1 = Task(
                description=f"Analyze: {prompt}. Use list_project_files to see the workspace. Produce a plan: which files to create/edit and what each should contain.",
                expected_output="A short implementation plan (files + purpose).",
                agent=researcher,
            )
            t2 = Task(
                description="Implement the plan. Write the actual code/files with full content. Be concrete and complete.",
                expected_output="Complete code for all planned files.",
                agent=coder,
            )
            t3 = Task(
                description="Review the produced code. List any bugs/fixes, then give the final summary of what was built.",
                expected_output="Review notes + final summary.",
                agent=reviewer,
            )
            agents = [researcher, coder, reviewer]

        crew = Crew(
            agents=agents,
            tasks=[t1, t2, t3] if req.mode == "dev" else [t1, t2],
            process=Process.sequential,
            verbose=False,
        )
        # ── Files jo crew ne workspace me likhi (verify) ──
        # P2 FIX (#159): snapshot BEFORE kickoff so we only report files the
        # crew actually created — the old full os.walk listed every
        # pre-existing workspace file as "created".
        def _file_snapshot():
            snap = set()
            try:
                for root, _dirs, files in os.walk(work_dir):
                    for f in files:
                        if f.startswith(".") or "node_modules" in root or ".git" in root:
                            continue
                        snap.add(os.path.relpath(os.path.join(root, f), work_dir))
            except Exception:
                pass
            return snap

        files_before = _file_snapshot()

        # NVIDIA jaisi backends transient "single tool-call" errors deti hain — retry
        raw = ""
        last_err = None
        for attempt in range(3):
            try:
                output = crew.kickoff(inputs={"prompt": prompt})
                raw = getattr(output, "raw", None) or str(output)
                if raw.strip():
                    break
            except Exception as e:
                last_err = e
                if req.model == "nvidia" and attempt < 2:
                    continue
                raise
        # P2 FIX (#148): kickoff returning empty output WITHOUT raising used to
        # slip past (last_err is None) → HTTP 200 with status="completed",
        # result="" as a fake success. Now it's an honest failure.
        if not raw.strip():
            if last_err:
                raise last_err
            raise HTTPException(502, "Crew kickoff completed but returned empty output")

        created_files = sorted(_file_snapshot() - files_before)

        return CrewRunResult(
            status="completed",
            result=raw[:8000],
            crew_output=raw[:20000],
            agents=[a.role for a in agents],
            files=created_files[:50],
            # P2 FIX (#159): never leak the absolute server-side workspace path.
            directory=os.path.basename(work_dir),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Crew run error: {e}")


# ------------------------------------------------------------------------------
# XLSX GENERATION — Real Excel with openpyxl
# ------------------------------------------------------------------------------
# P2 FIX (#158): generated files pile up in the shared system temp dir forever
# (unbounded disk growth). Sweep old artifacts of our own naming scheme on
# every generation; default names are salted with uuid so two requests in the
# same second can never overwrite each other.
_GENERATED_FILE_TTL_SECONDS = 24 * 3600


def _sweep_generated_files(directory: str, prefixes: tuple, ttl: int = _GENERATED_FILE_TTL_SECONDS) -> None:
    import time as _time
    try:
        now = _time.time()
        for name in os.listdir(directory):
            if not any(name.startswith(p) for p in prefixes):
                continue
            path = os.path.join(directory, name)
            try:
                if os.path.isfile(path) and now - os.path.getmtime(path) > ttl:
                    os.remove(path)
            except OSError:
                pass
    except Exception:
        pass


class XLSXRequest(BaseModel):
    topic: str
    title: str = ""
    columns: Optional[List[str]] = None  # Optional custom columns
    rows: int = 20


class XLSXResult(BaseModel):
    status: str
    # P3 #161: basename only — absolute server paths must not leak to callers
    # (download via GET /ai/files/{filename}).
    filename: str
    rows_written: int
    columns: List[str]


@app.post("/ai/xlsx/generate", response_model=XLSXResult)
def xlsx_generate(req: XLSXRequest):
    """Generate a real .xlsx file with openpyxl. Returns filename for download."""
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    import tempfile
    import os
    from datetime import datetime

    topic = req.topic.strip()
    if not topic:
        raise HTTPException(400, "Topic khali hai")

    # P2 FIX (#140): rows was unvalidated — rows=10**9 looped/allocated until
    # OOM, and negative rows wrote 0 rows while the response claimed
    # rows_written=req.rows (a negative count).
    if req.rows < 1 or req.rows > 10000:
        raise HTTPException(400, "rows must be between 1 and 10000")

    # Create workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"

    # Determine columns from topic or use custom
    if req.columns:
        columns = req.columns
    else:
        # Smart column detection based on topic
        topic_lower = topic.lower()
        if any(kw in topic_lower for kw in ['shaheed', 'martyr', 'jawan', 'soldier']):
            columns = ['Name', 'Rank', 'Regiment', 'Date', 'Place', 'State', 'Conflict']
        elif any(kw in topic_lower for kw in ['employee', 'staff', 'worker']):
            columns = ['Name', 'ID', 'Department', 'Role', 'Join Date', 'Salary']
        elif any(kw in topic_lower for kw in ['product', 'item', 'inventory']):
            columns = ['Product', 'Category', 'Price', 'Stock', 'SKU', 'Supplier']
        elif any(kw in topic_lower for kw in ['student', 'marks', 'grade']):
            columns = ['Name', 'Roll No', 'Subject', 'Marks', 'Grade', 'Semester']
        else:
            columns = ['Name', 'Category', 'Detail', 'Date', 'Notes']

    # Header style
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_alignment = Alignment(horizontal="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    # Write headers
    for col_idx, col_name in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    # Generate sample data rows (in production, LLM would provide real data)
    # For now, generate placeholder rows with topic-relevant content
    for row_idx in range(2, req.rows + 2):
        for col_idx, col_name in enumerate(columns, 1):
            # Simple placeholder generation
            if col_name.lower() == 'name':
                value = f"{topic} Entry {row_idx - 1}"
            elif col_name.lower() == 'date':
                value = datetime.now().strftime("%Y-%m-%d")
            elif col_name.lower() in ['rank', 'role', 'category', 'grade']:
                value = "TBD"
            elif col_name.lower() in ['price', 'salary', 'marks']:
                value = 0
            else:
                value = f"{topic} - {col_name} {row_idx - 1}"
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            cell.alignment = Alignment(wrap_text=True)

    # Auto-fit column widths
    for col_idx in range(1, len(columns) + 1):
        max_length = len(columns[col_idx - 1])
        for row_idx in range(2, min(req.rows + 2, 22)):
            cell_val = str(ws.cell(row=row_idx, column=col_idx).value or "")
            max_length = max(max_length, len(cell_val))
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = min(max_length + 4, 40)

    # Save to temp file
    temp_dir = tempfile.gettempdir()
    # P2 #158: uuid salt — hash(topic) alone collided for same-topic requests
    # in the same second; also sweep stale artifacts from earlier runs.
    import uuid
    _sweep_generated_files(temp_dir, ("xlsx_",))
    filename = f"xlsx_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.xlsx"
    file_path = os.path.join(temp_dir, filename)
    wb.save(file_path)

    return XLSXResult(
        status="completed",
        filename=filename,
        rows_written=req.rows,
        columns=columns
    )


# ------------------------------------------------------------------------------
# EDGE TTS — FREE unlimited text-to-speech (Microsoft Edge voices, no API key)
# ------------------------------------------------------------------------------
class TTSRequest(BaseModel):
    text: str
    voice: str = "en-IN-PrabhatNeural"   # hi-IN-SwaraNeural | en-US-JennyNeural | etc.
    rate: str = "+0%"

@app.post("/ai/tts")
def tts(req: TTSRequest):
    """Convert text to speech (MP3) via Microsoft Edge TTS — 100% free, no key."""
    import edge_tts
    import io as _io

    text = (req.text or "").strip()[:2000]
    if not text:
        raise HTTPException(400, "Text khali hai")

    # P3 #170: validate voice/rate (garbage values surfaced as generic 500s
    # from edge_tts) and throttle the free upstream (10 requests/minute).
    voice = (req.voice or "").strip()
    if not _re.match(r"^[a-z]{2,3}-[A-Z]{2,4}-[A-Za-z]+$", voice):
        raise HTTPException(400, f"Invalid voice '{voice}' — expected like 'en-IN-PrabhatNeural'")
    rate = (req.rate or "+0%").strip()
    if not _re.match(r"^[+-]\d{1,3}%$", rate):
        raise HTTPException(400, f"Invalid rate '{rate}' — expected like '+0%' or '-10%'")
    rate_val = int(rate[:-1])
    if abs(rate_val) > 100:
        raise HTTPException(400, "rate must be between -100% and +100%")
    rate = f"{'+' if rate_val >= 0 else ''}{rate_val}%"
    with _TTS_RATE["lock"]:
        now = _time.time()
        _TTS_RATE["times"] = [t for t in _TTS_RATE["times"] if now - t < _TTS_RATE["window"]]
        if len(_TTS_RATE["times"]) >= _TTS_RATE["max"]:
            raise HTTPException(429, "TTS rate limit — try again in a minute")
        _TTS_RATE["times"].append(now)

    try:
        async def _run():
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            audio = _io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio.write(chunk["data"])
            return audio.getvalue()
        import asyncio
        mp3 = asyncio.run(_run())
        if not mp3:
            raise HTTPException(500, "TTS ne koi audio nahi banaya")
        return Response(
            content=mp3,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=ai-dost-tts.mp3"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"TTS error: {e}")


# ------------------------------------------------------------------------------
# UNIFIED PYTHON AI GENERATION & CASCADE ROUTER
# ------------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = "You are AI-Dost, an expert AI developer assistant."
    model: Optional[str] = "auto"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048

class GenerateResult(BaseModel):
    status: str
    text: str
    model_used: str
    response_time: float

@app.post("/ai/generate", response_model=GenerateResult)
def ai_generate(req: GenerateRequest):
    """Centralized Python AI text & code generator with automatic cascade."""
    import time
    import requests
    start_time = time.time()
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(400, "Prompt cannot be empty")

    # P3 #164: bound the optional fields — an explicit null system_prompt used
    # to be stringified as "None" into every provider prompt, and unbounded
    # temperature/max_tokens went straight to upstream APIs.
    system_prompt = (
        req.system_prompt
        if isinstance(req.system_prompt, str) and req.system_prompt.strip()
        else "You are AI-Dost, an expert AI developer assistant."
    )[:8000]
    temperature = 0.7 if req.temperature is None else max(0.0, min(float(req.temperature), 2.0))
    max_tokens = 2048 if req.max_tokens is None else max(16, min(int(req.max_tokens), 32768))

    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    nvidia_key = os.environ.get("NVIDIA_API_KEY")
    together_key = os.environ.get("TOGETHER_API_KEY")

    # P2 FIX (#143): unknown models and explicit providers without API keys
    # used to skip every cascade branch and silently return an Ollama answer.
    _KNOWN_MODELS = ("auto", "groq", "gemini", "together", "ollama")
    if req.model not in _KNOWN_MODELS:
        raise HTTPException(
            400, f"Unknown model '{req.model}' — allowed: {', '.join(_KNOWN_MODELS)}"
        )
    _KEY_FOR = {"groq": groq_key, "gemini": gemini_key, "together": together_key}
    if req.model in _KEY_FOR and not _KEY_FOR[req.model]:
        raise HTTPException(
            400,
            f"model='{req.model}' requested but its API key is not set — use model='auto' for cascade",
        )

    # P2 FIX (#144): collect every provider failure — the old cascade discarded
    # all of them with bare `except: pass`, so the final 503 had no diagnostics.
    cascade_errors = []

    # 1. Groq (Fastest)
    if groq_key and req.model in ["auto", "groq"]:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=15
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                return GenerateResult(status="success", text=content, model_used="groq/llama-3.3-70b", response_time=time.time() - start_time)
            cascade_errors.append(f"groq HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            cascade_errors.append(f"groq: {e}")

    # 2. Gemini
    if gemini_key and req.model in ["auto", "gemini"]:
        try:
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            res = requests.post(
                url,
                headers={"Content-Type": "application/json", "x-goog-api-key": gemini_key},
                json={
                    "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                    "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}
                },
                timeout=20
            )
            if res.status_code == 200:
                data = res.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                return GenerateResult(status="success", text=content, model_used="gemini-2.5-flash", response_time=time.time() - start_time)
            cascade_errors.append(f"gemini HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            cascade_errors.append(f"gemini: {e}")

    # 3. Together AI
    if together_key and req.model in ["auto", "together"]:
        try:
            res = requests.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={"Authorization": f"Bearer {together_key}", "Content-Type": "application/json"},
                json={
                    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
                timeout=15
            )
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"]
                return GenerateResult(status="success", text=content, model_used="together/llama-3.3-70b", response_time=time.time() - start_time)
            cascade_errors.append(f"together HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            cascade_errors.append(f"together: {e}")

    # 4. Ollama fallback
    # P2 FIX (#143): only for model="auto"/"ollama" — an explicit provider
    # request must never silently degrade to a local Ollama answer.
    if req.model in ("auto", "ollama"):
        try:
            res = requests.post(
                f"{_ollama_base_url()}/api/generate",
                json={"model": "qwen2.5-coder:7b", "prompt": f"{system_prompt}\n\n{prompt}", "stream": False},
                timeout=30
            )
            if res.status_code == 200:
                return GenerateResult(status="success", text=res.json().get("response", ""), model_used="ollama/qwen2.5-coder", response_time=time.time() - start_time)
            cascade_errors.append(f"ollama HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            cascade_errors.append(f"ollama: {e}")

    # P2 FIX (#144): surface what actually failed instead of a bare 503.
    detail = "; ".join(cascade_errors[-5:]) if cascade_errors else "no provider attempted (missing API keys?)"
    print(f"[AI-GEN] cascade exhausted: {detail}", flush=True)
    raise HTTPException(503, f"All AI providers in Python Engine temporarily unavailable — {detail}")


# ------------------------------------------------------------------------------
# INLINE GHOST-TEXT CODE COMPLETION (Monaco Editor Bridge)
# ------------------------------------------------------------------------------
class CodeCompleteRequest(BaseModel):
    prefix: str
    suffix: Optional[str] = ""
    language: Optional[str] = "javascript"
    filename: Optional[str] = "file.js"

class CodeCompleteResult(BaseModel):
    completion: str
    language: str

@app.post("/ai/code/complete", response_model=CodeCompleteResult)
def code_complete(req: CodeCompleteRequest):
    """Fast inline code completion for Monaco Editor."""
    system = f"You are an ultra-fast code completion engine for {req.language}. Complete the code directly without explanations, markdown fences, or comments."
    prompt = f"File: {req.filename}\n\nCode before cursor:\n{req.prefix[-1000:]}\n\nCode after cursor:\n{req.suffix[:300]}\n\nCompletion:"
    try:
        gen = ai_generate(GenerateRequest(prompt=prompt, system_prompt=system, temperature=0.1, max_tokens=128))
        cleaned = gen.text.replace("```" + req.language, "").replace("```", "").strip()
        return CodeCompleteResult(completion=cleaned, language=req.language)
    except HTTPException:
        raise  # P3 #162: ai_generate's 503 (provider outage) must not become a fake 200 ""
    except Exception:
        return CodeCompleteResult(completion="", language=req.language)


# ------------------------------------------------------------------------------
# PYTHON CODE INSPECTOR & AST LINTER
# ------------------------------------------------------------------------------
class CodeAnalyzeRequest(BaseModel):
    code: str
    language: Optional[str] = "python"

class CodeAnalyzeResult(BaseModel):
    valid: bool
    issues: List[dict]
    summary: str

@app.post("/ai/code/analyze", response_model=CodeAnalyzeResult)
def code_analyze(req: CodeAnalyzeRequest):
    """Analyze code for syntax errors and logic bugs."""
    import ast
    issues = []
    if req.language == "python":
        try:
            ast.parse(req.code)
            return CodeAnalyzeResult(valid=True, issues=[], summary="Python syntax valid. No parse errors found.")
        except SyntaxError as e:
            issues.append({
                "line": e.lineno,
                "column": e.offset,
                "message": e.msg,
                "type": "SyntaxError"
            })
            return CodeAnalyzeResult(valid=False, issues=issues, summary=f"Syntax Error at line {e.lineno}: {e.msg}")
    # P3 #163: nothing is checked off-Python — say so instead of the
    # misleading "Code analyzed." with valid=True.
    return CodeAnalyzeResult(
        valid=True,
        issues=[],
        summary=f"Not analyzed: this endpoint only checks Python (requested language: {req.language}). No checks were run.",
    )


# ------------------------------------------------------------------------------
# PYTHON REPORTLAB PDF GENERATOR
# ------------------------------------------------------------------------------
class PDFGenerateRequest(BaseModel):
    title: str
    content: str
    filename: Optional[str] = None

class PDFGenerateResult(BaseModel):
    status: str
    filename: str
    # P3 #161: absolute file_path removed — server path disclosure; download
    # via GET /ai/files/{filename} instead.

@app.post("/ai/pdf/generate", response_model=PDFGenerateResult)
def pdf_generate(req: PDFGenerateRequest):
    """Generate high-quality PDF using Python."""
    import tempfile
    import os
    from datetime import datetime

    fname = req.filename or f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    temp_dir = tempfile.gettempdir()
    # P2 FIX (#158): default names carried only a per-second timestamp — two
    # requests in the same second overwrote each other. Salt with uuid and
    # sweep stale artifacts from earlier runs.
    if not req.filename:
        import uuid
        fname = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.pdf"
    _sweep_generated_files(temp_dir, ("doc_",))
    # P0 FIX (#126): filename is attacker-controlled. Reduce to basename, force
    # a safe charset, strip leading dots, ensure .pdf, then assert containment —
    # os.path.join otherwise happily honours "../..\\..\\evil.pdf" or absolute paths.
    fname = str(fname).replace("\\", "/").split("/")[-1]
    fname = re.sub(r"[^A-Za-z0-9._-]", "_", fname).lstrip(".").strip("_")
    if not fname:
        fname = "document.pdf"
    if not fname.lower().endswith(".pdf"):
        fname = (fname[:80] or "document") + ".pdf"
    out_path = os.path.abspath(os.path.join(temp_dir, fname))
    if not out_path.startswith(os.path.abspath(temp_dir) + os.sep):
        raise HTTPException(400, "Invalid filename")

    # Use basic canvas text generation
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(out_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, leading=22, spaceAfter=12)
        body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=8)

        # Escape title too — Paragraph() parses markup and unescaped < or &
        # breaks rendering / injects formatting (#154)
        safe_title = (req.title or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story = [Paragraph(safe_title, title_style), Spacer(1, 10)]
        for para in req.content.split("\n\n"):
            if para.strip():
                clean_p = para.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
                story.append(Paragraph(clean_p, body_style))

        doc.build(story)
        return PDFGenerateResult(status="completed", filename=fname)
    except Exception as e:
        raise HTTPException(500, f"PDF generation error: {e}")


@app.get("/ai/files/{filename}")
def get_generated_file(filename: str):
    """P3 #161: stream a generated artifact by BASENAME — replaces returning
    absolute server paths in XLSX/PDF responses (internal path disclosure)."""
    name = os.path.basename(str(filename))  # strips any traversal
    if not name or name != filename:
        raise HTTPException(400, "Invalid filename")
    temp_dir = tempfile.gettempdir()
    target = os.path.abspath(os.path.join(temp_dir, name))
    if not target.startswith(os.path.abspath(temp_dir) + os.sep):
        raise HTTPException(400, "Invalid filename")
    # only engine-generated artifacts (swept by _sweep_generated_files)
    if not (name.startswith(("xlsx_", "doc_")) or name.endswith((".xlsx", ".pdf"))):
        raise HTTPException(404, "File not found")
    if not os.path.isfile(target):
        raise HTTPException(404, "File not found")
    with open(target, "rb") as fh:
        data = fh.read()
    if name.endswith(".xlsx"):
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        media = "application/pdf"
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})



# ------------------------------------------------------------------------------
# RAG RETRIEVAL CONTRACTS (PHASE 2F.1)
# ------------------------------------------------------------------------------
class RetrievalFilter(BaseModel):
    source_types: Optional[List[str]] = []
    limit: Optional[int] = 10

class RetrievalRequest(BaseModel):
    version: str = "1"
    user_id: str
    project_id: str
    query: str
    mode: Optional[str] = "HYBRID"
    filters: Optional[RetrievalFilter] = RetrievalFilter()

class RetrievalResultItem(BaseModel):
    source_entity_id: str
    project_id: str
    source_type: str
    chunk_id: str
    score: float
    version_hash: str
    metadata: dict

class RetrievalResponse(BaseModel):
    version: str = "1"
    results: List[RetrievalResultItem]
    # P2 FIX (#150): HYBRID partial results are no longer silently passed off
    # as complete — callers can tell retrieval was degraded.
    degraded: bool = False


AUTHORITY_SCORES = {
    "workspace_file": 1.0,
    "artifact": 0.9,
    "verification_result": 0.9,
    "context_node": 0.8,
    "message": 0.6,
    "execution_history": 0.5
}

def get_authority_score(source_type: str) -> float:
    return AUTHORITY_SCORES.get(source_type, 0.5)

@app.post("/ai/rag/query", response_model=RetrievalResponse)
def rag_query(req: RetrievalRequest):
    """
    Phase 2F.4 Hybrid Retrieval & Ranking
    """
    if not req.project_id:
        raise HTTPException(400, "project_id is required for tenant isolation")
    
    if not rag_collection:
        raise HTTPException(503, "Vector store is unavailable")

    query_text = req.query.strip()
    if not query_text:
        return RetrievalResponse(version=req.version, results=[])

    mode = (req.mode or "HYBRID").upper()
    if mode not in ["EXACT", "FULL_TEXT", "SEMANTIC", "HYBRID"]:
        raise HTTPException(400, "unsupported mode")

    limit = req.filters.limit if req.filters and req.filters.limit else 10
    limit = max(1, min(limit, 100))

    where_filter = {"project_id": {"$eq": req.project_id}}
    
    if req.filters and req.filters.source_types:
        if len(req.filters.source_types) == 1:
            where_filter = {
                "$and": [
                    {"project_id": {"$eq": req.project_id}},
                    {"source_type": {"$eq": req.filters.source_types[0]}}
                ]
            }
        else:
            where_filter = {
                "$and": [
                    {"project_id": {"$eq": req.project_id}},
                    {"source_type": {"$in": req.filters.source_types}}
                ]
            }

    entity_candidates = {}

    def add_candidate(meta, chunk_id, sem_score, kw_score):
        src_id = meta.get("source_entity_id")
        if not src_id: return
        # P2 FIX (#137): the contract advertises per-user isolation but
        # retrieval only filtered on project_id — knowing a project_id granted
        # full read. Vectors carrying a user_id must match the caller; legacy
        # vectors without one stay visible so pre-isolation indexes keep working.
        vec_user = str(meta.get("user_id") or "")
        if vec_user and req.user_id and vec_user != str(req.user_id):
            return
        auth_score = get_authority_score(meta.get("source_type", ""))
        
        # Ranking Formula
        # alpha=0.6, beta=0.3, gamma=0.1
        final_score = (0.6 * sem_score) + (0.3 * kw_score) + (0.1 * auth_score)

        if src_id not in entity_candidates or final_score > entity_candidates[src_id]["score"]:
            entity_candidates[src_id] = {
                "source_entity_id": src_id,
                "project_id": meta.get("project_id", req.project_id),
                "source_type": meta.get("source_type", "unknown"),
                "chunk_id": chunk_id,
                "score": final_score,
                "version_hash": meta.get("version_hash", ""),
                # P2 FIX (#156): the contract field is a generic `metadata: dict`
                # — keep ALL keys (source_type/version_hash/chunk_index/user_id/
                # custom_*) instead of discarding everything except custom_*.
                "metadata": dict(meta),
            }

    degraded = False
    try:
        if mode == "EXACT":
            # P2 FIX (#151): EXACT used to run the identical $contains
            # full-text query as FULL_TEXT. Now the chunk must contain the
            # query as an exact (case-sensitive) contiguous phrase, and the
            # semantic stage never runs for this mode.
            kw_results = rag_collection.get(
                where=where_filter,
                where_document={"$contains": query_text}
            )
            if kw_results and kw_results["ids"]:
                docs = kw_results.get("documents") or [None] * len(kw_results["ids"])
                for idx, c_id in enumerate(kw_results["ids"]):
                    if query_text not in (docs[idx] or ""):
                        continue
                    add_candidate(kw_results["metadatas"][idx], c_id, sem_score=0.0, kw_score=1.0)
        elif mode in ("FULL_TEXT", "HYBRID"):
            kw_results = rag_collection.get(
                where=where_filter,
                where_document={"$contains": query_text}
            )
            if kw_results and kw_results["ids"]:
                for idx, c_id in enumerate(kw_results["ids"]):
                    add_candidate(kw_results["metadatas"][idx], c_id, sem_score=0.0, kw_score=1.0)
                    
        if mode in ["SEMANTIC", "HYBRID"]:
            sem_results = rag_collection.query(
                query_texts=[query_text],
                n_results=limit * 3,
                where=where_filter
            )
            if sem_results and sem_results["ids"] and len(sem_results["ids"][0]) > 0:
                for idx, c_id in enumerate(sem_results["ids"][0]):
                    dist = sem_results["distances"][0][idx]
                    meta = sem_results["metadatas"][0][idx]
                    
                    norm_score = 1.0 / (1.0 + dist)
                    
                    kw_score = 1.0 if (mode == "HYBRID" and meta.get("source_entity_id") in entity_candidates and entity_candidates[meta["source_entity_id"]]["chunk_id"] == c_id) else 0.0
                    
                    # Apply semantic threshold
                    if norm_score > 0.4 or kw_score > 0:
                        add_candidate(meta, c_id, sem_score=norm_score, kw_score=kw_score)
                    
    except Exception as e:
        if mode == "HYBRID" and entity_candidates:
            # P2 FIX (#150): partial results are useful but never silent —
            # log the failure and flag the response as degraded instead of
            # returning a bare 200 that looks complete. (HYBRID with zero
            # candidates = total failure → honest 500 like other modes.)
            print(f"[RAG] hybrid retrieval degraded, returning partial results: {e}", flush=True)
            degraded = True
        else:
            raise HTTPException(500, f"Retrieval failed: {str(e)}")

    sorted_results = sorted(entity_candidates.values(), key=lambda x: x["score"], reverse=True)
    return RetrievalResponse(version=req.version, results=sorted_results[:limit], degraded=degraded)



# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# RAG INDEXING SYNC CONTRACTS (PHASE 2F.3)
# ------------------------------------------------------------------------------
import hashlib
import chromadb
from chromadb.config import Settings
from llama_index.core.node_parser import SentenceSplitter

# Initialize ChromaDB persistent client
chroma_client = None
# Using default embedding function (all-MiniLM-L6-v2) for zero-configuration local execution
try:
    # P2 #160: absolute path — CWD-relative "./chroma_db" silently pointed at
    # a different vector DB depending on where uvicorn was started.
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))
    rag_collection = chroma_client.get_or_create_collection(name="ai_dost_derived_index")
except Exception as e:
    print(f"Warning: Could not initialize Chroma collection: {e}")
    rag_collection = None

text_splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)

def generate_chunk_id(project_id: str, source_entity_id: str, version_hash: str, index: int) -> str:
    s = f"{project_id}_{source_entity_id}_{version_hash}_{index}"
    return hashlib.sha256(s.encode()).hexdigest()

class IndexDocument(BaseModel):
    source_entity_id: str
    source_type: str
    version_hash: str
    content: Optional[str] = ""
    metadata: Optional[dict] = {}

class IndexRequest(BaseModel):
    version: str = "1"
    project_id: str
    action: str  # "upsert" or "delete"
    documents: List[IndexDocument]

class IndexResponse(BaseModel):
    status: str
    processed_count: int
    chunks_created: int = 0
    chunks_deleted: int = 0

@app.post("/ai/rag/index", response_model=IndexResponse)
def rag_index(req: IndexRequest):
    """
    Phase 2F.3 Embedding & Vector Index Pipeline
    """
    if not req.project_id:
        raise HTTPException(400, "project_id is required for tenant isolation")
    
    if req.action not in ["upsert", "delete"]:
        raise HTTPException(400, "invalid action")

    if not rag_collection:
        raise HTTPException(503, "Vector store is unavailable")

    chunks_created = 0
    chunks_deleted = 0

    # P0 FIX (#136): validate EVERY document before any purge. Previously the
    # loop purged existing vectors first, then skipped re-add when content was
    # empty → silent permanent data loss on a bad upsert request.
    seen_ids = set()  # P3 #172: reject duplicate source_entity_id in one request
    for doc in req.documents:
        if not doc.source_entity_id:
            raise HTTPException(400, "source_entity_id is required")
        # P3 #172: duplicates in one request used to self-delete — iteration 2's
        # purge removed iteration 1's just-inserted chunks (silent data loss).
        if doc.source_entity_id in seen_ids:
            raise HTTPException(
                400,
                f"duplicate source_entity_id '{doc.source_entity_id}' in one request — send each entity once",
            )
        seen_ids.add(doc.source_entity_id)
        if req.action == "upsert" and not (doc.content and str(doc.content).strip()):
            raise HTTPException(
                400,
                f"content is required to upsert '{doc.source_entity_id}' — refusing to purge existing vectors without re-adding"
            )

    for doc in req.documents:
        if not doc.source_entity_id:
            raise HTTPException(400, "source_entity_id is required")

        # 1. Always purge existing vectors for this entity to ensure idempotency and stale data removal
        # P2 FIX (#145): count the real number of chunks removed — the old code
        # added 1 per document ("we don't know how many were deleted"), so
        # IndexResponse.chunks_deleted lied about actual chunk counts.
        delete_filter = {
            "$and": [
                {"project_id": {"$eq": req.project_id}},
                {"source_entity_id": {"$eq": doc.source_entity_id}}
            ]
        }
        try:
            existing = rag_collection.get(where=delete_filter)
            n_existing = len(existing.get("ids") or [])
        except Exception:
            n_existing = 0
        try:
            rag_collection.delete(where=delete_filter)
            chunks_deleted += n_existing
        except Exception as e:
            # If nothing to delete, chroma might ignore or throw depending on
            # version — log it instead of pretending something was removed.
            print(f"[RAG] delete failed for {doc.source_entity_id}: {e}", flush=True)

        # 2. If upsert, chunk and embed
        if req.action == "upsert" and doc.content:
            chunks = text_splitter.split_text(doc.content)
            ids = []
            documents = []
            metadatas = []
            
            for idx, chunk_text in enumerate(chunks):
                chunk_id = generate_chunk_id(req.project_id, doc.source_entity_id, doc.version_hash, idx)
                
                # Enforce project isolation and lineage in vector metadata
                meta = {
                    "project_id": req.project_id,
                    "source_entity_id": doc.source_entity_id,
                    "source_type": doc.source_type,
                    "version_hash": doc.version_hash,
                    "chunk_index": idx,
                    "embedding_model": "default-minilm-l6-v2",
                    # P2 FIX (#137): persist user ownership so rag_query can
                    # actually enforce the contract's per-user isolation.
                    # Set BEFORE the custom_* merge so it stays a system key.
                    "user_id": str((doc.metadata or {}).get("user_id") or ""),
                }
                
                # Merge custom metadata securely (ensuring it doesn't overwrite system keys)
                if doc.metadata:
                    for k, v in doc.metadata.items():
                        if k not in meta and isinstance(v, (str, int, float, bool)):
                            meta[f"custom_{k}"] = v

                ids.append(chunk_id)
                documents.append(chunk_text)
                metadatas.append(meta)

            if ids:
                try:
                    rag_collection.add(
                        ids=ids,
                        documents=documents,
                        metadatas=metadatas
                    )
                    chunks_created += len(ids)
                except Exception as e:
                    raise HTTPException(500, f"Vector store insertion failed: {e}")

    return IndexResponse(
        status="success", 
        processed_count=len(req.documents),
        chunks_created=chunks_created,
        chunks_deleted=chunks_deleted
    )

# ── 16. VKP-Omni-2B Multimodal Engine Integration (NandiAi/VKP-Omni-2B) ───────
class VkpQueryPayload(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.3
    repetition_penalty: float = 1.15
    image_base64: Optional[str] = None

@app.get("/api/ai-dost/vkp-omni/status")
@app.get("/ai/vkp-omni/status")
async def vkp_status_endpoint():
    try:
        from vkp_omni_engine import vkp_status
        return await vkp_status()
    except Exception as e:
        return {"model_id": "NandiAi/VKP-Omni-2B", "loaded": False, "error": str(e)}

@app.post("/api/ai-dost/chat")
@app.post("/ai/vkp-omni/chat")
async def vkp_chat_endpoint(payload: VkpQueryPayload):
    try:
        from vkp_omni_engine import run_vkp_inference
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
        raise HTTPException(status_code=500, detail=f"VKP-Omni inference error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)







