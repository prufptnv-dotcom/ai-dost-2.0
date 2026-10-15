// Single source of truth for "user wants a picture rendered, not code".
//
// BUG THIS REPLACES: the old regexes used `\bimage\b`, which does NOT match
// the plural "images" (no word boundary after "image" before "s"). The real
// report was "ek cat ka images banao" → client MISS + server MISS → silent
// fallthrough to the plain LLM → it wrote a Python/Pillow plan instead of
// rendering. Also `banado`/`banade` never matched `\bbana\b`.
//
// Product decision (2026-10-01): only catch requests that carry an explicit
// image noun. Bare "cat banao" must NOT auto-render — it stays with the LLM.
//
// KEEP IN SYNC with backend/services/imageIntent.js — the sync is asserted
// by frontend/tests/imageIntent.test.js ("regex sources stay identical").

/** Words that mean a picture (plural-safe). */
const IMAGE_NOUN = /\b(?:images?|photos?|pics?|pictures?|logos?|wallpapers?|cartoons?|illustrations?|posters?|memes?|sketches?|paintings?|drawings?|artworks?|art|avatars?|thumbnails?|banners?|taasveer|tasveer|chitra)\b/i;

/** Creation verbs, Hinglish + English. `bana\s*do` also covers "banado". */
const MAKE_VERB = /\b(?:bana\s*(?:do|de|ke|kar\s*do)|banao|banwa\s*(?:do|de)|bana|make|create|generate|draw|design|paint|render|sketch|chahiye|nikalo)\b/i;

/** Explicit "give me the code" — never auto-render these. */
const CODE_ASK = /\b(?:code|program|script|source|python|pillow|pil|matplotlib|pyplot|pyautogui|syntax|snippet|api)\b/i;

/** Static images can't satisfy these — they belong to the 3D/animation pipeline. */
const NON_STATIC = /\b(?:three\.?js|webgl|animation|anime\.?js|kinetic typography|shader|particles?|simulation|gsap|lottie)\b/i;

/** Explanatory questions ("how to…") — answer, don't render. */
const HOW_TO = /\b(?:how to|kaise\s+(?:kare|kiye|karta|kiya|hai|hot[ae]?|bana(?:te|ta|ti))|tarika|tareeka|steps|method)\b/i;

/** Tokens stripped before sending a Hinglish request to the image model. */
const SUBJECT_STOP = /\b(?:ek|a|an|the|please|kripya|plz|mera|meri|mere|mujhe|hum|tum|is|ye|wo|that|this|ka|ki|ke|liye|chahiye|bana\s*(?:do|de|ke|kar\s*do)|banao|banwa\s*(?:do|de)|bana|make|create|generate|draw|design|paint|render|sketch|nikalo|images?|photos?|pics?|pictures?|logos?|wallpapers?|cartoons?|illustrations?|posters?|memes?|sketches?|paintings?|drawings?|artworks?|art|avatars?|thumbnails?|banners?|taasveer|tasveer|chitra|of|for|do|de)\b/gi;

/**
 * True when the message is a static-image generation request.
 * Cheap boolean — safe to call from render paths and regex `.test()`.
 */
export function isImageCreateRequest(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (!IMAGE_NOUN.test(t)) return false;
  if (!MAKE_VERB.test(t)) return false;
  if (HOW_TO.test(t)) return false;
  if (CODE_ASK.test(t)) return false;
  if (NON_STATIC.test(t)) return false;
  return true;
}

/**
 * Turn a Hinglish ask into a clean English-ish subject for the image model:
 * "ek cat ka images banao" → "cat".
 * Falls back to the original text when nothing survives stripping.
 */
export function extractImageSubject(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(SUBJECT_STOP, ' ')
    .replace(/[\s,;:.!?\-]+/g, ' ')
    .trim();
  return (stripped || raw).slice(0, 200);
}
