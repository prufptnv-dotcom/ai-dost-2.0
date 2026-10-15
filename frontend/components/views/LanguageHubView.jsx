import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Languages, ArrowRightLeft, Sparkles, Copy, Check, Volume2,
  BookOpen, CheckCircle2, Briefcase, MessageSquare, HelpCircle,
  RotateCcw, ArrowRight, Loader2, Award
} from 'lucide-react';
import axios from 'axios';

const LANGUAGES = [
  { id: 'english', name: 'English', script: 'Latin' },
  { id: 'hindi', name: 'Hindi (हिन्दी)', script: 'Devanagari' },
  { id: 'hinglish', name: 'Hinglish', script: 'Latin/Devanagari' },
  { id: 'sanskrit', name: 'Sanskrit (संस्कृतम्)', script: 'Devanagari' },
  { id: 'marathi', name: 'Marathi (मराठी)', script: 'Devanagari' },
  { id: 'bengali', name: 'Bengali (বাংলা)', script: 'Bengali' },
  { id: 'urdu', name: 'Urdu (اردو)', script: 'Perso-Arabic' },
  { id: 'technical-english', name: 'Technical English', script: 'Engineering' },
  { id: 'academic-english', name: 'Academic English', script: 'Research' }
];

const MODES = [
  { id: 'translate', name: 'Translation', icon: Languages, desc: 'Bidirectional Indic & English translation' },
  { id: 'grammar-check', name: 'Grammar Fixer', icon: CheckCircle2, desc: 'Identify errors with rule explanations' },
  { id: 'formalize', name: 'Formal & Corporate', icon: Briefcase, desc: 'Convert casual text to executive polish' },
  { id: 'simplify', name: 'Simple Language', icon: HelpCircle, desc: 'Plain English / ELI5 without jargon' },
  { id: 'spoken-practice', name: 'Spoken English', icon: MessageSquare, desc: 'Daily dialogues, intonation & phonetics' },
  { id: 'interview-prep', name: 'Interview English', icon: Award, desc: 'STAR articulation & confident vocabulary' },
  { id: 'vocab-builder', name: 'Vocab Builder', icon: BookOpen, desc: 'Roots, definitions, collocations & idioms' }
];

const PRESET_PROMPTS = [
  { label: 'Hindi to English', mode: 'translate', source: 'hindi', target: 'english', text: 'सफलता का कोई शॉर्टकट नहीं होता, इसके लिए निरंतर मेहनत आवश्यक है।' },
  { label: 'English to Sanskrit', mode: 'translate', source: 'english', target: 'sanskrit', text: 'Truth alone triumphs, not falsehood.' },
  { label: 'Corporate Email', mode: 'formalize', source: 'english', target: 'english', text: 'hey can you send the report today itself coz boss is asking for it' },
  { label: 'Check Grammar', mode: 'grammar-check', source: 'english', target: 'english', text: 'Yesterday he don\'t came to the office because his car was broke down.' },
  { label: 'Simplify Jargon', mode: 'simplify', source: 'english', target: 'english', text: 'The enterprise-wide synergy necessitates proactive paradigms for mission-critical deliverables.' },
  { label: 'Interview STAR Answer', mode: 'interview-prep', source: 'english', target: 'english', text: 'Tell me about a time you resolved a critical production bug under pressure.' },
  { label: 'Vocab: Resilience', mode: 'vocab-builder', source: 'english', target: 'english', text: 'Resilience' }
];

export default function LanguageHubView({ onToast }) {
  const [selectedMode, setSelectedMode] = useState('translate');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('hindi');
  const [inputText, setInputText] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [outputResult, setOutputResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Quick swap source & target languages
  const handleSwap = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('english');
    } else {
      const prevSource = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(prevSource);
    }
  };

  const handleProcess = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) {
      onToast?.('Please enter some text to process', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (selectedMode === 'grammar-check') {
        const res = await axios.post('/api/language/grammar', { text: inputText });
        if (res.data?.success) {
          setOutputResult(res.data.analysis);
          onToast?.('Grammar analysis completed!', 'success');
        }
      } else if (selectedMode === 'vocab-builder') {
        const res = await axios.post('/api/language/vocab', { word: inputText, targetAudience: context || 'general' });
        if (res.data?.success) {
          setOutputResult(res.data.profile);
          onToast?.('Vocabulary profile generated!', 'success');
        }
      } else {
        const res = await axios.post('/api/language/process', {
          text: inputText,
          mode: selectedMode,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          context
        });
        if (res.data?.success) {
          setOutputResult(res.data.output);
          onToast?.(`${MODES.find(m => m.id === selectedMode)?.name || 'Language'} completed!`, 'success');
        }
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!outputResult) return;
    navigator.clipboard.writeText(outputResult);
    setCopied(true);
    onToast?.('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = async () => {
    if (!outputResult) return;
    try {
      setSpeaking(true);
      // Clean markdown tags for audio reading
      const cleanText = outputResult
        .replace(/###|##|#|\*|_|`|\[|\]|\(|\)/g, '')
        .slice(0, 300);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 0.95;
        if (targetLang === 'hindi') {
          utterance.lang = 'hi-IN';
        } else {
          utterance.lang = 'en-US';
        }
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        onToast?.('Text-to-speech is not supported in this browser.', 'warning');
        setSpeaking(false);
      }
    } catch (err) {
      setSpeaking(false);
      onToast?.('Failed to play speech', 'error');
    }
  };

  const applyPreset = (preset) => {
    setSelectedMode(preset.mode);
    setSourceLang(preset.source);
    setTargetLang(preset.target);
    setInputText(preset.text);
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base text-paper-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Languages className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-paper-100">Language & Translation Hub</h1>
              <p className="text-xs md:text-sm text-ink-muted">
                Bidirectional Indic & English translation, grammar fixing, corporate polish & spoken English
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Category 15 • Polyglot AI
          </span>
        </div>
      </div>

      {/* Mode Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = selectedMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                active
                  ? 'bg-indigo-600/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-500/10'
                  : 'bg-canvas-subtle/50 border-border-subtle hover:border-border-default text-paper-200 hover:text-paper-100'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1.5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-ink-muted'}`} />
              <span className="text-xs font-semibold">{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-text-tertiary whitespace-nowrap flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Presets:
        </span>
        {PRESET_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => applyPreset(p)}
            className="px-2.5 py-1 rounded-full bg-canvas-subtle border border-border-subtle hover:border-indigo-500/40 text-text-secondary hover:text-indigo-300 transition-colors whitespace-nowrap"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Form & Output Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col space-y-4 flex-1">
            {/* Language Selectors (When applicable) */}
            {selectedMode !== 'grammar-check' && selectedMode !== 'vocab-builder' && (
              <div className="flex items-center gap-2 bg-canvas-base/80 p-2 rounded-xl border border-border-subtle">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-semibold text-text-tertiary mb-1">From</label>
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="auto" className="bg-canvas-base">Auto-Detect</option>
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id} className="bg-canvas-base">
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap languages"
                  className="p-2 rounded-lg hover:bg-canvas-subtle text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>

                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-semibold text-text-tertiary mb-1">To</label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium text-text-primary focus:outline-none cursor-pointer"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id} className="bg-canvas-base">
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Input Text Area */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-text-secondary">
                  {selectedMode === 'vocab-builder' ? 'Word or Idiom to Study:' : 'Input Text:'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-tertiary">{inputText.length} chars</span>
                  {inputText && (
                    <button
                      onClick={() => setInputText('')}
                      className="text-[11px] text-text-tertiary hover:text-text-secondary flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedMode === 'grammar-check'
                    ? 'Paste or type sentences to check for grammar, tense, and syntax errors...'
                    : selectedMode === 'formalize'
                    ? 'Enter casual notes, slack messages, or rough email drafts to formalize...'
                    : selectedMode === 'simplify'
                    ? 'Enter complex technical jargon or legal phrases to simplify...'
                    : selectedMode === 'interview-prep'
                    ? 'Enter an interview question or your draft answer to refine...'
                    : selectedMode === 'spoken-practice'
                    ? 'Enter a scenario or conversation topic to practice spoken English dialogues...'
                    : selectedMode === 'vocab-builder'
                    ? 'Enter a single word (e.g. Ubiquitous, Ephemeral, Pragmatic)...'
                    : 'Enter text in Hindi, English, Hinglish, Sanskrit, Marathi, Bengali, or Urdu...'
                }
                rows={selectedMode === 'vocab-builder' ? 3 : 7}
                className="w-full bg-canvas-base border border-border-subtle rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500/60 resize-none font-sans"
              />
            </div>

            {/* Optional Context Field */}
            {selectedMode !== 'vocab-builder' && (
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">
                  Context / Special Instructions (Optional):
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Email to VP, Conversational tone, Technical interview..."
                  className="w-full bg-canvas-base border border-border-subtle rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleProcess}
              disabled={loading || !inputText.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing with Linguistic Engine...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedMode === 'grammar-check'
                      ? 'Check Grammar & Syntax'
                      : selectedMode === 'formalize'
                      ? 'Convert to Formal English'
                      : selectedMode === 'simplify'
                      ? 'Simplify Language'
                      : selectedMode === 'interview-prep'
                      ? 'Refine for Interview'
                      : selectedMode === 'vocab-builder'
                      ? 'Build Vocabulary Profile'
                      : 'Translate Nuance'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output & Nuance Breakdown */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Linguistic Result
                </h3>
              </div>

              {outputResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSpeak}
                    disabled={speaking}
                    className="p-1.5 rounded-lg bg-canvas-base border border-border-subtle hover:border-indigo-500/50 text-text-secondary hover:text-indigo-400 transition-colors"
                    title="Listen via Text-To-Speech"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${speaking ? 'animate-pulse text-indigo-400' : ''}`} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas-base border border-border-subtle hover:border-indigo-500/50 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Output Content Area */}
            <div className="flex-1 bg-canvas-base rounded-xl border border-border-subtle p-4 overflow-y-auto max-h-[500px]">
              {loading ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-text-tertiary space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                  <p className="text-xs">Applying grammar rules, cultural idioms & linguistic nuance...</p>
                </div>
              ) : outputResult ? (
                <div className="prose prose-invert prose-xs max-w-none space-y-3 text-text-primary leading-relaxed text-xs">
                  <pre className="whitespace-pre-wrap font-sans bg-transparent border-0 p-0 text-text-primary">
                    {outputResult}
                  </pre>
                </div>
              ) : (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-text-tertiary text-center p-6 space-y-2">
                  <Languages className="w-8 h-8 text-text-tertiary/40" />
                  <p className="text-xs font-medium text-text-secondary">Ready for Translation or Linguistic Transformation</p>
                  <p className="text-[11px] max-w-xs text-text-tertiary">
                    Select a mode, choose languages, or try one of the preset prompts to see live grammar breakdowns and cultural translations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
