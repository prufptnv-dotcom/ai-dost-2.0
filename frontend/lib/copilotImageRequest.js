// Copilot-side image short-circuit.
//
// Why this exists: CopilotIDE used to send EVERY prompt to /api/agent/plan,
// so "ek cat ka images banao" became a multi-file engineering plan and the
// agent started writing Python/Pillow code. Image generation is not a build
// task — it must never reach the planner.
//
// Extracted from the component so it can be unit-tested with a fake api.

import { extractImageSubject } from './imageIntent';

/**
 * @param {object} p
 * @param {string} p.prompt raw user text
 * @param {{post: Function}} p.api axios-like client (mockable)
 * @param {(msg: {role: string, content: string}) => void} p.pushMessage
 * @param {(status: {label: string, tone: string}) => void} [p.setStatus]
 * @returns {Promise<{ok: boolean, url?: string, error?: string}>}
 */
export async function runCopilotImageRequest({ prompt, api, pushMessage, setStatus }) {
  const subject = extractImageSubject(prompt);
  pushMessage({ role: 'user', content: prompt });
  setStatus?.({ label: `Rendering image: ${subject.slice(0, 40)}`, tone: 'info' });

  try {
    const res = await api.post('/image/turbo', { prompt: subject, style: 'general' });
    const url = res?.data?.imageUrl;
    if (!url) throw new Error(res?.data?.error || 'Image model ne URL return nahi kiya.');
    pushMessage({
      role: 'assistant',
      content: `⚡ **Z-Image Turbo Generated!** 🎨\n\n![Generated image](${url})\n\n[⬇️ Download Image](${url})\n\n*Prompt: ${subject}*`,
    });
    setStatus?.({ label: 'Image rendered', tone: 'success' });
    return { ok: true, url };
  } catch (err) {
    const detail = err?.response?.data?.error || err?.message || 'Image model unavailable.';
    pushMessage({
      role: 'assistant',
      content: `⚠️ **Image generate nahi ho payi.**\n\n${detail}\n\n*Request:* "${prompt}"`,
    });
    setStatus?.({ label: 'Image failed', tone: 'error' });
    return { ok: false, error: detail };
  }
}
