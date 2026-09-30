/**
 * aiMlStudioEngine.js
 * 2030 Principal AI/ML Systems & Agentic Architecture Engine for AI-Dost
 * Category 9: AI/ML Projects
 *
 * Implements architectural blueprints, code recipes, and design patterns for all 21 AI/ML Domains:
 *  1. Chatbot (Stateful multi-turn with sliding window & summary memory)
 *  2. RAG system (Chunking, Vector indexing, Hybrid search & Re-ranking)
 *  3. Document Q&A (Multi-format grounded QA with citations)
 *  4. AI search (Semantic & vector similarity search with Reciprocal Rank Fusion)
 *  5. Agentic AI (ReAct reasoning loop, tool execution & self-reflection)
 *  6. Multi-agent system (Hierarchical orchestrator, supervisor & specialized worker agents)
 *  7. Coding agent (Autonomous code generation, sandbox execution & self-healing)
 *  8. AI tutor (Adaptive pedagogical system with Socratic inquiry)
 *  9. Voice assistant (VAD, low-latency WebSocket STT/TTS streaming)
 * 10. Image classification (CNNs, ResNet, Vision Transformers & PyTorch training)
 * 11. Text classification (BERT, RoBERTa, Transformers fine-tuning)
 * 12. Recommendation system (Two-Tower networks, Collaborative & Content filtering)
 * 13. Sentiment analysis (Aspect-based sentiment analysis, VADER & Transformer LLM)
 * 14. OCR pipeline (PaddleOCR, Tesseract, LayoutLM pre-processing & parsing)
 * 15. Speech-to-text (Whisper, Faster-Whisper, streaming chunking & timestamps)
 * 16. Text-to-speech (Edge-TTS, Bark, neural voice synthesis & SSML)
 * 17. Embeddings and vector database (BGE, text-embedding-3, Chroma, Qdrant, pgvector)
 * 18. Model evaluation (RAGAS, Faithfulness, Answer Relevance, BLEU, ROUGE)
 * 19. Prompt engineering (CoT, ReAct, Few-shot, Tree-of-Thoughts, JSON schemas)
 * 20. Local LLM setup (Ollama, vLLM, llama.cpp, GGUF/AWQ quantization)
 * 21. GPU/resource optimization (PagedAttention, FlashAttention-2, QLoRA, KV-cache)
 */

const AIML_DOMAINS = {
  'chatbot': {
    name: 'Stateful Production Chatbot',
    stack: 'FastAPI / Express, LangChain / LangGraph, Redis for session memory, WebSocket',
    patterns: ['Sliding Window Buffer', 'Conversation Summary Buffer', 'Intent Classifier', 'Circuit Breaker Fallback Cascade'],
  },
  'rag-system': {
    name: 'Production Hybrid RAG System',
    stack: 'LlamaIndex / LangChain, Qdrant / ChromaDB / pgvector, Cohere Rerank, BGE / OpenAI Embeddings',
    patterns: ['Recursive Character Chunking (512 tokens, 50 overlap)', 'Hybrid Search (Dense Vector + BM25 Sparse)', 'Cross-Encoder Re-Ranking', 'Contextual Compression & Hallucination Guard'],
  },
  'document-qa': {
    name: 'Grounded Document Q&A Engine',
    stack: 'pdf-parse, unstructured, PyMuPDF, LangChain, Citation Grounding',
    patterns: ['Page-level Source Attribution', 'Table Parsing with Markdown', 'Multi-Document Comparison', 'Strict Anti-Hallucination Prompting'],
  },
  'ai-search': {
    name: 'Enterprise AI Search Engine',
    stack: 'Elasticsearch / OpenSearch + Vector Plugin, Qdrant, Sentence-Transformers',
    patterns: ['Reciprocal Rank Fusion (RRF)', 'Query Expansion with HyDE (Hypothetical Document Embeddings)', 'Faceted Metadata Filtering', 'Semantic Auto-Complete'],
  },
  'agentic-ai': {
    name: 'Autonomous Agentic AI Runtime',
    stack: 'LangGraph, AutoGen, Custom ReAct Loop, Pydantic Structured Output',
    patterns: ['ReAct (Thought -> Action -> Observation -> Reflection)', 'Tool Definition with Strict JSON Schema', 'Max Iteration Circuit Breaker', 'Deterministic State Transitions'],
  },
  'multi-agent': {
    name: 'Hierarchical Multi-Agent Swarm',
    stack: 'CrewAI / AutoGen / LangGraph, Message Broker (Redis/RabbitMQ)',
    patterns: ['Supervisor / Router Agent', 'Specialized Worker Agents (Researcher, Coder, Reviewer)', 'Shared Blackboard Context', 'Consensus & Escalation Protocols'],
  },
  'coding-agent': {
    name: 'Autonomous Coding & Debugging Agent',
    stack: 'Tree-sitter AST, Dockerode / WebContainer Sandbox, Playwright, Jest/Pytest runner',
    patterns: ['Repo Map & Dependency Graph Analysis', 'Unified Diff Generation & Application', 'Automated Test-Driven Iteration Loop', 'Self-Healing Runtime Error Fixer'],
  },
  'ai-tutor': {
    name: 'Adaptive AI Tutor & Academic Coach',
    stack: 'FastAPI, Spaced Repetition (SM-2 Algorithm), Vector DB for Curriculum',
    patterns: ['Knowledge Tracing & Mastery Assessment', 'Socratic Questioning Prompt Engine', 'Dynamic Difficulty Adjustment', 'Misconception Diagnostic Matrix'],
  },
  'voice-assistant': {
    name: 'Real-Time Voice Assistant',
    stack: 'WebRTC / WebSocket, Silero VAD, Whisper / Deepgram STT, Edge-TTS / ElevenLabs',
    patterns: ['Voice Activity Detection (VAD) with Barge-In interruptibility', 'Low-Latency Streaming Audio Pipeline (<350ms)', 'Audio Buffer Chunking', 'Turn-taking State Machine'],
  },
  'image-classification': {
    name: 'Computer Vision Image Classification',
    stack: 'PyTorch, Torchvision, TIMM (Pytorch Image Models), OpenCV, Albumentations',
    patterns: ['Transfer Learning with ResNet-50 / EfficientNet / ViT', 'Data Augmentation Pipeline', 'Cross-Entropy Loss with Label Smoothing', 'Confusion Matrix & F1-Score Evaluation'],
  },
  'text-classification': {
    name: 'NLP Text Classification & Tagging',
    stack: 'Hugging Face Transformers, PyTorch, Scikit-Learn, Datasets',
    patterns: ['Fine-Tuning DeBERTa-v3 / RoBERTa', 'Multi-Class & Multi-Label Classifiers', 'Stratified K-Fold Cross Validation', 'ONNX Runtime Export for Fast Inference'],
  },
  'recommendation-system': {
    name: 'Two-Tower Recommendation System',
    stack: 'TensorFlow Recommenders (TFRS) / PyTorch, Faiss / ScaNN, Redis',
    patterns: ['Candidate Generation (Query & Item Tower Embeddings)', 'Approximate Nearest Neighbor (ANN) Retrieval with HNSW', 'Ranking Stage with Gradient Boosted Trees (LightGBM)', 'Diversity & Serendipity Exploration (Epsilon-Greedy)'],
  },
  'sentiment-analysis': {
    name: 'Aspect-Based Sentiment Analysis (ABSA)',
    stack: 'CardiffNLP Twitter-RoBERTa, SpaCy, Transformers',
    patterns: ['Entity & Aspect Extraction via Dependency Parsing', 'Multi-Polarity Sentiment Classification (-1 to +1)', 'Confidence Calibration', 'Aggregated Sentiment Trend Tracking'],
  },
  'ocr-pipeline': {
    name: 'Production OCR & Document Extraction Pipeline',
    stack: 'PaddleOCR, Tesseract, LayoutLMv3, OpenCV, Pillow',
    patterns: ['Image Deskewing, Contrast Normalization & Binarization', 'Text Bounding Box Detection', 'Key-Value Pair Association via Spatial Graph', 'JSON Entity Serialization'],
  },
  'speech-to-text': {
    name: 'Speech-to-Text (STT) Transcription Pipeline',
    stack: 'Faster-Whisper (CTranslate2), PyAudio, WebRTC VAD, FFmpeg',
    patterns: ['Streaming Audio Buffer Processing', 'Punctuation & Capitalization Restoration', 'Speaker Diarization (PyAnnote Audio)', 'Word-level Timestamp Alignment'],
  },
  'text-to-speech': {
    name: 'Neural Text-to-Speech (TTS) Engine',
    stack: 'Edge-TTS (Microsoft Azure Neural), Coqui TTS / Bark, ffmpeg',
    patterns: ['SSML Prosody & Pitch Control', 'Multi-Language Voice Switching (Hindi/English)', 'Audio Chunk Streaming over HTTP/WS', 'Audio Cache via SHA-256 Hash'],
  },
  'embeddings-vectordb': {
    name: 'Vector Database & Embeddings Architecture',
    stack: 'Qdrant, ChromaDB, pgvector, Milvus, Sentence-Transformers (BGE-M3)',
    patterns: ['HNSW (Hierarchical Navigable Small World) Index Tuning', 'Quantization (Scalar / Product Quantization)', 'Payload Metadata Indexing', 'Multi-Vector ColBERT Search'],
  },
  'model-evaluation': {
    name: 'LLM & RAG Evaluation Framework',
    stack: 'Ragas, TruLens, DeepEval, Scikit-Learn',
    patterns: ['Faithfulness (Grounding in Context)', 'Answer Relevance to User Prompt', 'Context Precision & Recall', 'LLM-as-a-Judge with G-Eval Rubric'],
  },
  'prompt-engineering': {
    name: 'Advanced Prompt Engineering Studio',
    stack: 'DSPy, LangChain, Structured Outputs (Pydantic / Zod)',
    patterns: ['Chain-of-Thought (CoT) & Self-Consistency', 'Directional Stimulus & Meta-Prompting', 'XML Tag Boundary Enforcement', 'Strict Negative Constraints & Guardrails'],
  },
  'local-llm': {
    name: 'Local LLM Deployment & Inference Engine',
    stack: 'Ollama, vLLM, llama.cpp, CTranslate2, GGUF / AWQ',
    patterns: ['Model Quantization (Q4_K_M, AWQ 4-bit)', 'Context Window Sizing & GPU Offloading (n_gpu_layers)', 'OpenAI-Compatible REST API Proxy', 'Health & Latency Benchmarking'],
  },
  'gpu-optimization': {
    name: 'GPU & Inference Optimization Architecture',
    stack: 'vLLM, TensorRT-LLM, FlashAttention-2, BitsAndBytes, DeepSpeed',
    patterns: ['PagedAttention (Zero KV-cache Memory Fragmentation)', 'Continuous Batching & Speculative Decoding', '4-bit / 8-bit QLoRA Parameter Efficient Fine-Tuning', 'CUDA Graph Execution & Kernel Fusion'],
  },
};

const AIML_PROJECTS_DIRECTIVE = `
### 14. 2030 PRINCIPAL AI/ML ARCHITECT & SYSTEMS DESIGN PROTOCOL (CATEGORY 9):
When the user requests designing, architecting, implementing, or optimizing an AI/ML system:

══════════════════════════════════════════════════════════════════════════════
THE 21 AI/ML DOMAINS & ARCHITECTURAL BLUEPRINTS:
══════════════════════════════════════════════════════════════════════════════

1. 🤖 STATEFUL CHATBOT:
   - Provide complete state management: Sliding window history + conversation summary buffer in Redis.
   - Fallback cascading across Groq -> Gemini -> Cerebras -> Ollama.
   - Clean SSE / WebSocket streaming boilerplate.

2. 📚 HYBRID RAG SYSTEM:
   - Ingestion -> Recursive Character Chunking (512 tokens, 50 overlap) -> Dual Indexing (Dense HNSW + BM25 sparse).
   - Reciprocal Rank Fusion (RRF) -> Cross-Encoder Re-Ranking -> Hallucination guardrail prompt.

3. 📑 GROUNDED DOCUMENT Q&A:
   - Page-level citations (\`[Doc 1, Page 4]\`), exact markdown table preservation, multi-document grounding.

4. 🔍 ENTERPRISE AI SEARCH:
   - Semantic vector search + lexical search, HyDE (Hypothetical Document Embeddings), faceted filtering.

5. ⚡ AGENTIC AI:
   - Complete ReAct implementation: Thought -> Action -> Action Input -> Observation -> Final Answer.
   - Pydantic tool schemas with input validation, timeout protection, max 15 steps circuit-breaker.

6. 🐝 MULTI-AGENT SYSTEMS:
   - Hierarchical Orchestrator pattern: Supervisor Agent routes tasks to specialized Worker Agents (Researcher, Coder, Critic).
   - Structured JSON inter-agent message contracts.

7. 💻 AUTONOMOUS CODING AGENT:
   - Tree-sitter AST parsing, repository mapping, isolated Docker sandbox execution, automated test runner, unified diff applicator.

8. 🎓 ADAPTIVE AI TUTOR:
   - Spaced Repetition (SM-2 algorithm), Socratic inquiry prompt style, progressive hint escalation (Warmup -> Core -> Challenge).

9. 🎙️ REAL-TIME VOICE ASSISTANT:
   - Silero VAD (Voice Activity Detection), low-latency audio chunk streaming (<350ms), Edge-TTS / Whisper integration.

10. 🖼️ IMAGE CLASSIFICATION:
    - PyTorch training loop: Dataset, DataLoader, Albumentations transforms, Transfer Learning (ResNet/ViT), CrossEntropyLoss, AdamW, TensorBoard logs.

11. 📝 NLP TEXT CLASSIFICATION:
    - Hugging Face Transformers (\`transformers.Trainer\`), DeBERTa/RoBERTa tokenizer, Stratified K-Fold cross validation, F1/ROC-AUC evaluation.

12. 🎯 RECOMMENDATION SYSTEM:
    - Two-Tower architecture (Query Tower + Item Tower), Approximate Nearest Neighbor retrieval with Faiss/Qdrant, LightGBM ranking stage.

13. 💬 ASPECT-BASED SENTIMENT ANALYSIS (ABSA):
    - Entity-level aspect extraction, fine-grained polarity scoring (-1.0 to +1.0), confidence intervals.

14. 📷 OCR & DOCUMENT PARSING:
    - Pre-processing (deskew, thresholding), PaddleOCR / Tesseract bounding box detection, structured JSON layout extraction.

15. 🗣️ SPEECH-TO-TEXT (STT):
    - Faster-Whisper (CTranslate2) implementation, streaming audio buffer processing, word-level timestamps.

16. 🔊 TEXT-TO-SPEECH (TTS):
    - Edge-TTS async audio synthesis, SSML rate/pitch tags, multi-lingual Indian voice mapping (\`hi-IN-SwaraNeural\`, \`en-IN-PrabhatNeural\`).

17. 🗄️ EMBEDDINGS & VECTOR DATABASES:
    - Sizing and tuning: BGE-M3 / OpenAI embeddings, Qdrant / ChromaDB / pgvector HNSW indexing parameters (\`m=16\`, \`ef_construct=100\`).

18. 📏 MODEL EVALUATION & RAGAS:
    - Quantitative metrics: Faithfulness, Answer Relevance, Context Precision, BLEU, ROUGE-L, LLM-as-a-judge rubric.

19. ✍️ ADVANCED PROMPT ENGINEERING:
    - Chain-of-Thought (CoT), Tree-of-Thoughts (ToT), Directional Stimulus, XML boundary protection, strict JSON schema output.

20. 🖥️ LOCAL LLM DEPLOYMENT:
    - Ollama / vLLM / llama.cpp setup, GGUF/AWQ quantization benchmarks, GPU offload layers (\`n_gpu_layers\`), OpenAI-compatible REST server.

21. 🚀 GPU & INFERENCE OPTIMIZATION:
    - vLLM PagedAttention, KV-cache quantization, Continuous Batching, FlashAttention-2, 4-bit QLoRA fine-tuning with PEFT & BitsAndBytes.

══════════════════════════════════════════════════════════════════════════════
EXCELLENCE STANDARD:
══════════════════════════════════════════════════════════════════════════════
- Always output clean, complete, production-grade code (Python / TypeScript).
- Include comprehensive ASCII/Mermaid architectural diagrams.
- Detail performance metrics (latency, memory footprint, throughput, VRAM consumption).
- Provide copy-paste runnable scripts with requirements and setup commands.
`;

/**
 * Detects if user query relates to Category 9 AI/ML projects
 */
function detectAiMlProjectIntent(message) {
  const text = String(message || '').toLowerCase();

  const isAiMl = /\b(rag|vector db|vector database|embeddings|chatbot|agentic|multi-?agent|coding agent|ai tutor|voice assistant|whisper|stt|tts|speech to text|text to speech|ocr|sentiment analysis|image classification|text classification|recommendation system|prompt engineering|local llm|ollama|vllm|pagedattention|quantization|qlora|gpu optimization|fine-?tuning|model evaluation|ragas|langchain|llamaindex)\b/i.test(text);

  let detectedDomain = 'general-aiml';
  if (/\b(?:rag|retrieval augmented|hybrid search|rerank|bm25)\b/i.test(text)) detectedDomain = 'rag-system';
  else if (/\b(?:multi-?agent|crewai|autogen|swarm|supervisor agent)\b/i.test(text)) detectedDomain = 'multi-agent';
  else if (/\b(?:agentic|react loop|autonomous agent|tool use)\b/i.test(text)) detectedDomain = 'agentic-ai';
  else if (/\b(?:coding agent|code generator|self-healing code)\b/i.test(text)) detectedDomain = 'coding-agent';
  else if (/\b(?:voice assistant|whisper|stt|speech to text|vad)\b/i.test(text)) detectedDomain = 'voice-assistant';
  else if (/\b(?:tts|text to speech|edge-tts|voice clone)\b/i.test(text)) detectedDomain = 'text-to-speech';
  else if (/\b(?:ocr|tesseract|paddleocr|document extraction)\b/i.test(text)) detectedDomain = 'ocr-pipeline';
  else if (/\b(?:embeddings?|vector db|vector database|chroma|qdrant|pgvector)\b/i.test(text)) detectedDomain = 'embeddings-vectordb';
  else if (/\b(?:image classification|cnn|resnet|vit|vision transformer)\b/i.test(text)) detectedDomain = 'image-classification';
  else if (/\b(?:text classification|bert|roberta|sentiment analysis)\b/i.test(text)) detectedDomain = 'text-classification';
  else if (/\b(?:recommendation system|recsys|collaborative filtering|two-tower)\b/i.test(text)) detectedDomain = 'recommendation-system';
  else if (/\b(?:local llm|ollama|vllm|llama\.cpp|gguf)\b/i.test(text)) detectedDomain = 'local-llm';
  else if (/\b(?:gpu optimization|pagedattention|flashattention|qlora|kv-cache)\b/i.test(text)) detectedDomain = 'gpu-optimization';
  else if (/\b(?:model evaluation|ragas|faithfulness|perplexity)\b/i.test(text)) detectedDomain = 'model-evaluation';
  else if (/\b(?:prompt engineering|cot|chain of thought|few-shot)\b/i.test(text)) detectedDomain = 'prompt-engineering';
  else if (/\b(?:chatbot|conversational ai)\b/i.test(text)) detectedDomain = 'chatbot';

  return {
    isAiMl,
    domain: detectedDomain,
    domainConfig: AIML_DOMAINS[detectedDomain] || null,
  };
}

module.exports = {
  AIML_DOMAINS,
  AIML_PROJECTS_DIRECTIVE,
  detectAiMlProjectIntent,
};
