/**
 * writingCommunicationEngine.js
 * 2030 Principal Writing, Copywriting & Professional Communication Engine for AI-Dost
 * Category 11: Writing aur Communication
 *
 * Implements all 17 Writing Capabilities:
 *  1. Formal email
 *  2. Application (Job, Leave, Academic, Grant)
 *  3. Letter (Official, Business, Recommendation)
 *  4. Resume content (Action-verb achievement bullets, summaries)
 *  5. LinkedIn post (Hook, storytelling, value, CTA, hashtags)
 *  6. YouTube script (Hook, timestamps, B-roll cues, retention tactics)
 *  7. Documentary script (Cinematic pacing, voiceover narration, atmospheric cues)
 *  8. Blog (Engaging H2/H3 layout, reader retention, SEO readability)
 *  9. Article (Thought leadership, journalistic depth, analytical synthesis)
 * 10. Research abstract (Background, Methods, Results, Conclusion)
 * 11. Project description (Tech stack, problem-solution, architecture, metrics)
 * 12. Product description (Benefit-driven copy, feature breakdown, conversion CTA)
 * 13. Social media caption (Viral hooks, emojis, audience resonance)
 * 14. Hindi-English translation (Nuanced bilingual preservation)
 * 15. Hinglish content (Authentic urban Indian creator & tech tone)
 * 16. Grammar correction (Typo, syntax, tense, punctuation diagnosis)
 * 17. Professional rewriting (Polishing weak/informal drafts into executive prose)
 *
 * Implements all 9 Customizable Tones:
 *  1. Formal
 *  2. Simple
 *  3. Professional
 *  4. Friendly
 *  5. Persuasive (non-political/general)
 *  6. Academic
 *  7. Technical
 *  8. Short and direct
 *  9. Detailed
 */

const WRITING_FORMATS = {
  'formal-email': {
    name: 'Formal Business & Executive Email',
    sections: ['Subject Line (Punchy, clear, action-oriented)', 'Salutation', 'Executive Context & Purpose', 'Action Items / Key Deliverables', 'Call to Action & Timeline', 'Professional Sign-off'],
    guidelines: 'Subject line under 60 chars. First paragraph must state the exact purpose within 2 sentences. Use bullet points for multiple requests.'
  },
  'application': {
    name: 'Official Application (Job, Leave, Academic, Grant)',
    sections: ['Applicant & Recipient Details', 'Formal Subject Header', 'Opening Statement & Reference', 'Qualifications / Justification of Request', 'Supporting Evidence / Portfolio Link', 'Closing Pledge & Courteous Sign-off'],
    guidelines: 'Maintain utmost respect and formal decorum. Explicitly state dates, designations, reference numbers, or roll numbers.'
  },
  'letter': {
    name: 'Official & Business Letter',
    sections: ['Sender & Receiver Headers with Date', 'Salutation', 'Formal Body (Context, Exposition, Request)', 'Resolution / Next Steps', 'Formal Complimentary Close & Signature'],
    guidelines: 'Follow standard postal or digital letter format with balanced paragraphs.'
  },
  'resume-content': {
    name: 'High-Impact Resume Content & Bullets',
    sections: ['Professional Summary / Objective', 'Key Achievement Bullets (XYZ Formula: Accomplished [X] as measured by [Y] by doing [Z])', 'Core Competencies / Skills taxonomy', 'Project Highlights & Metrics'],
    guidelines: 'Lead every bullet with strong power action verbs (Architected, Spearheaded, Accelerated). Zero passive voice.'
  },
  'linkedin-post': {
    name: 'Viral LinkedIn Post & Thought Leadership',
    sections: ['Hook (First 2 lines before "see more")', 'The Conflict / Observation / Lesson', 'Actionable Framework / Steps (White-space formatted)', 'Engaging Question / Call-to-Action', '3-5 Relevant Hashtags'],
    guidelines: 'Use 1-2 sentence paragraphs for high mobile readability. Avoid buzzword fluff; provide genuine professional insight.'
  },
  'youtube-script': {
    name: 'High-Retention YouTube Script',
    sections: ['Hook (0:00 - 0:15s): Pattern interrupt & high-stakes payoff', 'Intro & Title Card (0:15 - 0:45s)', 'Core Chapters with [Visual / B-Roll / Screen Recording] notes', 'Pattern Interrupts every 60-90s', 'Outro, Subscribe Hook & Next Video Teaser'],
    guidelines: 'Write for the ear, not the eye. Include explicit visual cues like [Cut to B-roll], [On-screen Graphic], [Sound effect: whoosh].'
  },
  'documentary-script': {
    name: 'Cinematic Documentary Script',
    sections: ['Atmospheric Scene Setting [Scene / Ambient Audio]', 'Narrator Voiceover (Poetic, deep, contemplative)', 'Archival / Interview Dialogue Injections', 'Pacing & Music Cues [Music swells / silence]', 'Climactic Synthesis & Lingering Question'],
    guidelines: 'Evocative sensory language, rhythmic cadence, cinematic drama, historical or philosophical gravitas.'
  },
  'blog': {
    name: 'Modern Engaging Blog Post',
    sections: ['Catchy H1 Title', 'Introduction with Hook & Story', 'Subheadings (H2, H3) with Scannable Content', 'Real-world Examples / Code or Case study', 'Conclusion & Discussion Question'],
    guidelines: 'Conversational yet authoritative tone. Use bold highlights, callout quotes, and scannable formatting.'
  },
  'article': {
    name: 'In-Depth Analytical Article',
    sections: ['Compelling Headline & Subtitle', 'Thesis Statement & Global Context', 'Evidence-Backed Core Arguments', 'Counter-Perspectives & Nuance', 'Forward-Looking Synthesis'],
    guidelines: 'Journalistic integrity, balanced argumentation, high intellectual rigor.'
  },
  'research-abstract': {
    name: 'Academic Research Abstract',
    sections: ['Background & Problem Statement (1-2 sentences)', 'Specific Objectives / Hypotheses', 'Methodology & Experimental Design', 'Key Findings & Quantitative Data', 'Broader Significance & Implications'],
    guidelines: 'Strict 150-300 word density. Precise academic nomenclature, zero speculation.'
  },
  'project-description': {
    name: 'Technical Project Description',
    sections: ['Project Name & Elevator Pitch', 'Problem Addressed & Target Users', 'Architecture & Tech Stack Breakdown', 'Core Features & Technical Innovations', 'Deployment, Performance & Measurable Impact'],
    guidelines: 'Ideal for GitHub README, portfolio, client pitch, or hackathon submissions.'
  },
  'product-description': {
    name: 'High-Converting Product Description',
    sections: ['Magnetic Hook / Tagline', 'The Core Problem Solved', 'Key Features as Tangible User Benefits', 'Technical Specs / Compatibility Table', 'Guarantee / Social Proof / Call to Action'],
    guidelines: 'Benefit-driven copywriting (Sell the vacation, not the plane ticket). Emotional appeal paired with rational proof.'
  },
  'social-media-caption': {
    name: 'Punchy Social Media Caption (IG / X / Threads)',
    sections: ['Attention-Grabbing First Line', 'Core Message / Story / Humor', 'Call to Action (Save, Share, Comment)', 'Curated Hashtags'],
    guidelines: 'Dynamic emojis, line breaks, mobile-optimized punchiness.'
  },
  'hindi-english-translation': {
    name: 'Bilingual Translation & Localization (Hindi ⇄ English)',
    sections: ['Source Text Reference', 'Accurate Contextual Translation', 'Cultural / Idiomatic Nuance Notes', 'Alternative Formal vs Colloquial Options'],
    guidelines: 'Preserve emotional intent and natural phrasing; never do robotic word-for-word translation.'
  },
  'hinglish-content': {
    name: 'Natural Urban Hinglish Content',
    sections: ['Authentic Conversational Opening', 'Core Narrative in Smooth Romanized Hinglish', 'Relatable Cultural Touchpoints', 'Engaging Outro'],
    guidelines: 'Flow naturally like contemporary Indian tech founders, creators, and students talk. Seamless code-switching.'
  },
  'grammar-correction': {
    name: 'Deep Grammar, Syntax & Style Correction',
    sections: ['Polished & Corrected Version', 'Error Breakdown (Spelling, Tense, Subject-Verb Agreement, Punctuation)', 'Style & Clarity Improvements Made', 'Word Choice Upgrades'],
    guidelines: 'Highlight exact corrections cleanly with side-by-side or diff breakdown.'
  },
  'professional-rewriting': {
    name: 'Executive & Professional Rewriting',
    sections: ['Original Draft Audit (Weaknesses & Tone Mismatch)', 'Executive Polished Rewrite', 'Key Enhancements (Active Voice, Elevated Vocabulary, Crispness)', 'Optional Alternative Angles'],
    guidelines: 'Transform raw or unstructured drafts into world-class C-suite ready communication.'
  }
};

const WRITING_TONES = {
  'formal': {
    name: 'Formal & Traditional',
    description: 'Polite, respectful, structured, conventional vocabulary, proper protocols.'
  },
  'simple': {
    name: 'Simple & Clear',
    description: 'Plain language, elementary vocabulary, short punchy sentences, zero confusing jargon.'
  },
  'professional': {
    name: 'Modern Professional',
    description: 'Crisp, corporate, results-oriented, polite, confident, and action-focused.'
  },
  'friendly': {
    name: 'Warm & Friendly',
    description: 'Approachable, warm, conversational, empathetic, and inviting.'
  },
  'persuasive': {
    name: 'Compelling & Persuasive',
    description: 'Benefit-driven, inspiring, convincing, strong calls to action (ethical & non-political).'
  },
  'academic': {
    name: 'Scholarly & Academic',
    description: 'Formal, evidence-grounded, objective, rigorous syntax, academic vocabulary.'
  },
  'technical': {
    name: 'Technical & Precise',
    description: 'Architectural terminology, specifications, zero fluff, maximum signal-to-noise ratio.'
  },
  'short-and-direct': {
    name: 'Short & Direct (TL;DR)',
    description: 'Ultra-concise, straight to the point, bullet points, zero filler phrases.'
  },
  'detailed': {
    name: 'Comprehensive & Detailed',
    description: 'Deep dive, comprehensive context, thorough background, exhaustive breakdowns.'
  }
};

const WRITING_COMMUNICATION_DIRECTIVE = `
### 16. 2030 MASTER COMMUNICATOR & COPYWRITER PROTOCOL (CATEGORY 11):
When the user asks for writing, drafting, emails, letters, applications, scripts, blogs, translations, grammar correction, or rewriting:

══════════════════════════════════════════════════════════════════════════════
CORE WRITING & COMMUNICATION PRINCIPLES:
══════════════════════════════════════════════════════════════════════════════
1. 🎯 TONE ADAPTATION:
   Strictly embody the requested tone (Formal, Simple, Professional, Friendly, Persuasive, Academic, Technical, Short & Direct, or Detailed).
   If no tone is specified, default to Modern Professional with warmth.

2. 💎 STRUCTURE & SCANNABILITY:
   - Use bold headers, clean spacing, and bullet points where appropriate.
   - For emails, always include a high-converting Subject line.
   - For scripts, include timestamps and camera/visual directions [in brackets].
   - For LinkedIn/Social, craft an irresistible hook in the first 2 lines.

3. 🇮🇳 HINDI, ENGLISH & HINGLISH MASTERY:
   - If Hindi is requested, write fluent, dignified Shuddh or standard Hindi (Devanagari).
   - If Hinglish is requested, write authentic, modern urban Hinglish (Roman script) that sounds natural, relatable, and smart.
   - For translations, preserve contextual essence rather than literal word-by-word conversion.

4. ✍️ ZERO FLUFF GUARANTEE:
   - Delete filler phrases ("I hope this email finds you well", "In today's fast-paced world").
   - Prefer strong active verbs over passive voice.
   - Deliver ready-to-send, copy-pasteable masterpieces.
`;

/**
 * Detects if user query relates to Category 11 Writing and Communication
 */
function detectWritingIntent(message) {
  const text = String(message || '').toLowerCase();

  const isWriting = /\b(email|application|letter|resume content|resume summary|linkedin post|youtube script|documentary script|blog|article|research abstract|project description|product description|caption|translate|translation|hinglish|grammar|rewrite|rewriting|patra|khat|prarthana patra|lekhan|dastavej)\b/i.test(text)
    || /\b(?:formal email|job application|leave application|cover letter|write a letter|script likho|post likho|blog likho|article likho|angrezi me translate|hindi me translate|grammar theek karo|polish karo|rewrite karo|tone badlo)\b/i.test(text);

  let detectedFormat = 'general-writing';
  // Action-oriented transformations first
  if (/\b(?:rewrite|rewriting|paraphrase|professional rewrite|polish text|polish karo|rephrase)\b/i.test(text)) detectedFormat = 'professional-rewriting';
  else if (/\b(?:grammar|spelling|grammar correction|correct my english|shuddhata)\b/i.test(text)) detectedFormat = 'grammar-correction';
  else if (/\b(?:translate|translation|anuvad|hindi me translate|english me translate)\b/i.test(text)) detectedFormat = 'hindi-english-translation';
  // Specific document and content types
  else if (/\b(?:resume|resumes|cv|curriculum vitae)\b/i.test(text)) detectedFormat = 'resume-content';
  else if (/\b(?:emails?|mail|formal email|business email)\b/i.test(text)) detectedFormat = 'formal-email';
  else if (/\b(?:applications?|job application|leave application|application likho|prarthana patra)\b/i.test(text)) detectedFormat = 'application';
  else if (/\b(?:letters?|formal letter|official letter|patra|khat)\b/i.test(text)) detectedFormat = 'letter';
  else if (/\b(?:linkedin|linkedin post|viral post)\b/i.test(text)) detectedFormat = 'linkedin-post';
  else if (/\b(?:youtube script|video script|yt script)\b/i.test(text)) detectedFormat = 'youtube-script';
  else if (/\b(?:documentary|documentary script)\b/i.test(text)) detectedFormat = 'documentary-script';
  else if (/\b(?:blogs?|blog post|blog likho)\b/i.test(text)) detectedFormat = 'blog';
  else if (/\b(?:articles?|article likho|lekh)\b/i.test(text)) detectedFormat = 'article';
  else if (/\b(?:abstract|research abstract|paper abstract)\b/i.test(text)) detectedFormat = 'research-abstract';
  else if (/\b(?:project description|project summary|readme summary)\b/i.test(text)) detectedFormat = 'project-description';
  else if (/\b(?:product description|copywriting|ad copy)\b/i.test(text)) detectedFormat = 'product-description';
  else if (/\b(?:captions?|social media post|ig caption|insta caption)\b/i.test(text)) detectedFormat = 'social-media-caption';
  else if (/\b(?:hinglish|hinglish content|hinglish me)\b/i.test(text)) detectedFormat = 'hinglish-content';

  // Detect Tone
  let detectedTone = 'professional';
  if (/\b(?:formal|official|respectful|aadar)\b/i.test(text)) detectedTone = 'formal';
  else if (/\b(?:simple|saral|easy|plain)\b/i.test(text)) detectedTone = 'simple';
  else if (/\b(?:friendly|casual|warm|dostana)\b/i.test(text)) detectedTone = 'friendly';
  else if (/\b(?:persuasive|convincing|inspiring|influencing)\b/i.test(text)) detectedTone = 'persuasive';
  else if (/\b(?:academic|scholarly|research tone)\b/i.test(text)) detectedTone = 'academic';
  else if (/\b(?:technical|deep tech|precise)\b/i.test(text)) detectedTone = 'technical';
  else if (/\b(?:short and direct|concise|tldr|point to point|seedha)\b/i.test(text)) detectedTone = 'short-and-direct';
  else if (/\b(?:detailed|vistar|in-depth|exhaustive|lamba)\b/i.test(text)) detectedTone = 'detailed';

  return {
    isWriting,
    format: detectedFormat,
    formatConfig: WRITING_FORMATS[detectedFormat] || null,
    tone: detectedTone,
    toneConfig: WRITING_TONES[detectedTone] || null
  };
}

module.exports = {
  WRITING_FORMATS,
  WRITING_TONES,
  WRITING_COMMUNICATION_DIRECTIVE,
  detectWritingIntent,
};
