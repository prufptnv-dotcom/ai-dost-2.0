import api from '../services/api';
import { extractArtifact, stripInternalTags } from '../utils/chatContent';
import { getFuturistic2030Html } from '../lib/threeJsTemplates';
import { BLOCK_FALLBACK_KEY } from '../components/chat/taskRuntime';

export async function streamChatResponse({
  content,
  selectedModel,
  history,
  persona,
  aiMsgId,
  setMessages,
  setThinking,
  setThinkingLabel,
  setActiveArtifact,
  setLastReply,
  setShowFollowUps,
  signal,
}) {
  const startedAt = Date.now();
  let accumulated = '';
  let accumulatedThought = '';
  let thoughtStartTime = Date.now();
  let thoughtEndTime = null;
  let firstChunkAt = null;
  let doneModel = null;
  let buffer = '';
  let lastChunkUpdate = 0;
  let lastThoughtUpdate = 0;

  const buildMeta = (isStopped = false) => ({
    provider: doneModel || null,
    totalMs: Date.now() - startedAt,
    ttfbMs: firstChunkAt ? firstChunkAt - startedAt : null,
    stopped: isStopped,
  });

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        model: selectedModel === 'auto' ? 'auto' : selectedModel,
        section: 'chat',
        history,
        mode: 'chat',
        persona,
      }),
      signal,
    });

    if (!response.ok) throw new Error(`Streaming failed: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'language_lock') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, detectedResponseLanguage: parsed.detectedResponseLanguage, languageName: parsed.languageName } : m
              )
            );
          }
          if (parsed.type === 'web_search_start') {
            setThinking(true);
            setThinkingLabel(parsed.intent === 'URL_FETCH' ? 'Reading webpage…' : 'Searching the web…');
          }
          if (parsed.type === 'web_search_sources' && parsed.sources) {
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, sources: parsed.sources } : m)));
          }
          if (parsed.type === 'web_search_done') setThinking(false);
          if (parsed.type === 'assessment_creating') {
            setThinking(true);
            setThinkingLabel(parsed.status || 'Preparing assessment...');
          }
          if (parsed.type === 'assessment_created' && parsed.assessment) {
            setThinking(false);
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, assessment: parsed.assessment } : m)));
          }
          if (parsed.done && parsed.model) doneModel = parsed.model;
          if (parsed.done && parsed.assessment) {
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, assessment: parsed.assessment } : m)));
          }
          if (parsed.done && parsed.sources && parsed.sources.length > 0) {
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, sources: parsed.sources } : m)));
          }
          // Deep Reasoning / Chain-of-Thought Stream Ingestion
          if (parsed.type === 'thought_chunk' && parsed.thought) {
            accumulatedThought += parsed.thought;
            const now = Date.now();
            const elapsedSec = (now - thoughtStartTime) / 1000;
            if (now - lastThoughtUpdate > 30) {
              lastThoughtUpdate = now;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, thought: accumulatedThought, isThinkingTrace: true, thoughtElapsed: elapsedSec } : m
                )
              );
            }
          }
          if (parsed.type === 'thought_done') {
            if (!thoughtEndTime) thoughtEndTime = Date.now();
            const elapsedSec = (thoughtEndTime - thoughtStartTime) / 1000;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, thought: accumulatedThought, isThinkingTrace: false, thoughtElapsed: elapsedSec, thoughtCompleted: true }
                  : m
              )
            );
          }
          if (parsed.chunk) {
            if (!firstChunkAt) firstChunkAt = Date.now();
            if (accumulatedThought && !thoughtEndTime) {
              thoughtEndTime = Date.now();
            }
            const currentElapsed = thoughtEndTime ? (thoughtEndTime - thoughtStartTime) / 1000 : 0;
            accumulated += parsed.chunk;
            const now = Date.now();
            if (now - lastChunkUpdate > 30) {
              lastChunkUpdate = now;
              const clean = stripInternalTags(accumulated);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        content: clean,
                        isStreaming: true,
                        isThinkingTrace: false,
                        thought: accumulatedThought || m.thought,
                        thoughtElapsed: currentElapsed || m.thoughtElapsed,
                      }
                    : m
                )
              );
            }
          }
        } catch (_) {}
      }
    }

    let finalReply = accumulated;
    const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
    const imageMatch = finalReply.match(imageTagRegex);
    if (imageMatch) {
      const imagePromptText = imageMatch[1].trim();
      const turboUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        imagePromptText
      )}?width=1024&height=768&model=turbo&seed=${Date.now()}&nologo=true`;
      finalReply = finalReply.replace(imageTagRegex, '').trim();
      finalReply += `\n\n![⚡ Z-Image Turbo: ${imagePromptText}](${turboUrl})\n\n[⬇️ Download Image](${turboUrl})`;
    }

    finalReply = stripInternalTags(finalReply);

    // Empty reply has two very different causes:
    //  1. Agent run answered this request (phase/tool events, no chat chunks) —
    //     await the run's terminal event (covers the approval pause cycle) and
    //     use THAT text. Firing the REST cascade here used to produce a
    //     duplicate "provider busy" bubble minutes later.
    //  2. Genuine stream failure (503 / capacity) — REST cascade fallback.
    if (!finalReply || !finalReply.trim()) {
      const marker = typeof window !== 'undefined' ? window[BLOCK_FALLBACK_KEY] : null;
      if (marker && marker.kind === 'agent') {
        // Live plan checklist in the chat bubble while the run executes
        // (marker.agentPlan covers events fired before this listener attached).
        const applyPlan = (tasks) => {
          if (!Array.isArray(tasks) || !tasks.length) return;
          setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, agentPlan: tasks } : m)));
        };
        if (Array.isArray(marker.agentPlan)) applyPlan(marker.agentPlan);
        const onTaskEvent = (evt) => {
          const detail = evt?.detail;
          if (!detail || (marker.taskId && detail.taskId && detail.taskId !== marker.taskId)) return;
          applyPlan(detail.tasks);
        };
        window.addEventListener('ai_dost_task_event', onTaskEvent);
        try {
          if (marker.settled) {
            finalReply = marker.reply || '';
          } else {
            finalReply = await new Promise((resolve, reject) => {
              let done = false;
              const finish = (value) => {
                if (!done) {
                  done = true;
                  resolve(typeof value === 'string' ? value : '');
                }
              };
              const onAbort = () => {
                if (!done) {
                  done = true;
                  const err = new Error('The operation was aborted');
                  err.name = 'AbortError';
                  reject(err);
                }
              };
              marker.done.then(() => finish(marker.reply), () => finish(''));
              if (signal) {
                if (signal.aborted) onAbort();
                else signal.addEventListener('abort', onAbort, { once: true });
              }
              // Safety valve: never hang the composer if a run dies silently.
              setTimeout(() => finish(marker.reply || ''), 15 * 60 * 1000);
            });
          }
        } catch (err) {
          if (err?.name === 'AbortError' || signal?.aborted) throw err;
          finalReply = '';
        } finally {
          window.removeEventListener('ai_dost_task_event', onTaskEvent);
        }
      } else {
        try {
          const fallbackRes = await api.post('/chat', {
            message: content,
            model: selectedModel === 'auto' ? 'auto' : selectedModel,
            section: 'chat',
            history,
            mode: 'chat',
            persona,
          });
          finalReply = stripInternalTags(fallbackRes.data?.reply || fallbackRes.data?.message || '');
        } catch (_) {}
      }
    }

    if (!finalReply || !finalReply.trim()) {
      if (
        /three\.?js|webgl|dna|helix|genetic|molecule|cellular|highway|road|car|vehicle|city|skyline|crystal|quantum|polyhedron|solar system|earth|gravity|orbit|space simulation|3d planet|game|runner|tron|hyperdrive|logo|brand|reveal|text|typography|kinetic|font|2030|cyberpunk|ultra hd|3d simulation|3d scene|3d model|3d visual|simulation/i.test(
          content
        )
      ) {
        const futuristicHtml = getFuturistic2030Html(content);
        finalReply = `### 🚀 2030 Ultra-HD 3D Interactive Experience (Three.js + WebGL)\n\nAapka **2030 Ultra-HD Futuristic Experience** ready hai! Isme 1990s retro styling ko chhodkar cyberpunk lighting, real-time shaders, 3D perspective transforms, aur interactive controls integrate kiye gaye hain:\n\n\`\`\`html\n${futuristicHtml}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** button par click karke is 2030 Ultra-HD experience ko interactively play aur explore kar sakte hain.*`;
      } else if (/anime\.?js|2d animation|motion design|krishna|peacock|aura/i.test(content)) {
        finalReply = `### ✨ 3D Interactive Animation (Anime.js)\n\nYeh raha aapka **3D Animation** component! Isme 3D perspective, continuous rotating aura, aur smooth Anime.js motion integrate kiya gaya hai:\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>\n  <style>\n    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #0d1b2a 0%, #000814 100%); overflow: hidden; perspective: 1000px; font-family: sans-serif; }\n    .scene { position: relative; width: 300px; height: 300px; transform-style: preserve-3d; display: flex; align-items: center; justify-content: center; }\n    .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(254, 215, 102, 0.7); box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); transform-style: preserve-3d; }\n    .ring-1 { width: 260px; height: 260px; border-color: #38bdf8; box-shadow: 0 0 30px #0284c7; }\n    .ring-2 { width: 200px; height: 200px; border-color: #facc15; box-shadow: 0 0 35px #eab308; }\n    .ring-3 { width: 140px; height: 140px; border-color: #a855f7; box-shadow: 0 0 40px #9333ea; }\n    .center-orb { width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle, #fef08a 20%, #eab308 60%, #ca8a04 100%); box-shadow: 0 0 50px #fbbf24; transform: translateZ(50px); }\n    .peacock-feather { position: absolute; top: -40px; font-size: 34px; filter: drop-shadow(0 0 10px #22c55e); transform: translateZ(70px); }\n    .title { position: absolute; bottom: 20px; color: #fde047; font-size: 15px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 12px rgba(250,204,21,0.8); }\n  </style>\n</head>\n<body>\n  <div class="scene">\n    <div class="ring ring-1"></div>\n    <div class="ring ring-2"></div>\n    <div class="ring ring-3"></div>\n    <div class="center-orb"></div>\n    <div class="peacock-feather">🪶</div>\n  </div>\n  <div class="title">Divine 3D Motion Aura</div>\n  <script>\n    anime({\n      targets: '.ring-1',\n      rotateX: [0, 360],\n      rotateY: [0, 180],\n      duration: 6000,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-2',\n      rotateY: [0, 360],\n      rotateZ: [0, 180],\n      duration: 4500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-3',\n      rotateX: [360, 0],\n      rotateZ: [0, 360],\n      duration: 3500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.center-orb, .peacock-feather',\n      translateZ: [30, 80],\n      scale: [0.95, 1.1],\n      direction: 'alternate',\n      duration: 1800,\n      loop: true,\n      easing: 'easeInOutQuad'\n    });\n  </script>\n</body>\n</html>\n\`\`\`\n\n*Aap upar **Run/Preview** button par click karke is animation ko live dekh sakte hain.*`;
      } else {
        finalReply = 'Main abhi respond nahi kar paya kyunki AI provider temporarily busy hai. Please kuch second baad dobara message karein.';
      }
    }

    const totalThoughtElapsed = thoughtEndTime
      ? (thoughtEndTime - thoughtStartTime) / 1000
      : accumulatedThought
      ? (Date.now() - thoughtStartTime) / 1000
      : 0;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === aiMsgId
          ? {
              ...m,
              content: finalReply,
              thought: accumulatedThought || m.thought,
              thoughtElapsed: totalThoughtElapsed || m.thoughtElapsed,
              isStreaming: false,
              isThinkingTrace: false,
              thoughtCompleted: true,
              meta: buildMeta(false),
            }
          : m
      )
    );
    setLastReply(finalReply);

    const artifact = extractArtifact(finalReply);
    if (artifact) setActiveArtifact(artifact);

    if (/\b(fullstack|project|app|website|web ?site|portfolio|mern|crud|clone|todo|blog|e-?commerce|chatbot|dashboard|landing page)\b.*\b(banao|bana|banake|make|create|build|generate)\b|\b(banao|bana|banake|make|create|build|generate)\b.*\b(project|app|website|web ?site|fullstack)\b/i.test(content)) {
      const bridgeMsg = {
        id: Date.now() + 2,
        role: 'assistant',
        content: 'Isko workspace mein open karke full project bana sakte hain.',
        timestamp: new Date().toISOString(),
        navView: 'copilot',
        navLabel: 'Open in Workspace',
      };
      setMessages((prev) => [...prev, bridgeMsg]);
    }

    setShowFollowUps(true);
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      const partial = stripInternalTags(accumulated || '');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: partial && partial.trim() ? partial : '⏹ Response stopped.',
                thought: accumulatedThought || m.thought,
                isStreaming: false,
                isThinkingTrace: false,
                thoughtCompleted: true,
                meta: buildMeta(true),
              }
            : m
        )
      );
      if (partial && partial.trim()) setLastReply(partial);
      return;
    }
    console.warn('Stream failed, falling back to REST:', err.message);
    try {
      const res = await api.post('/chat/', {
        message: content,
        model: selectedModel === 'auto' ? 'auto' : selectedModel,
        section: 'chat',
        history,
        mode: 'chat',
        persona,
      });
      let reply0 = stripInternalTags(res.data?.reply || res.data?.message || 'Response nahi mila.');
      const restImgMatch = reply0.match(/\[GENERATE_IMAGE:\s*(.*?)\]/i);
      if (restImgMatch) {
        const restImgPrompt = restImgMatch[1].trim();
        const restTurboUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
          restImgPrompt
        )}?width=1024&height=768&model=turbo&seed=${Date.now()}&nologo=true`;
        reply0 = reply0.replace(/\[GENERATE_IMAGE:\s*(.*?)\]/i, '').trim();
        reply0 += `\n\n![⚡ Z-Image Turbo: ${restImgPrompt}](${restTurboUrl})`;
      }
      const restThought = res.data?.thought || '';
      const restElapsed = (res.data?.duration || 1400) / 1000;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: reply0,
                thought: restThought || m.thought,
                thoughtElapsed: restElapsed,
                detectedResponseLanguage: res.data?.detectedResponseLanguage,
                languageName: res.data?.languageName,
                isStreaming: false,
                isThinkingTrace: false,
                thoughtCompleted: true,
                meta: buildMeta(false),
              }
            : m
        )
      );
      setLastReply(reply0);
      const artifact = extractArtifact(reply0);
      if (artifact) setActiveArtifact(artifact);
      setShowFollowUps(true);
    } catch (e2) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: 'Main abhi respond nahi kar paya. Please thoda wait karke dobara try karo.',
                isStreaming: false,
              }
            : m
        )
      );
    }
  } finally {
    setThinking(false);
    setThinkingLabel('Thinking…');
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('__aiDostInterruptedTask');
        window.dispatchEvent(new CustomEvent('ai_dost_clear_recovery'));
      }
    } catch (_) {}
  }
}
