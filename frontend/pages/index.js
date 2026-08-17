import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Sparkles, MessageSquare, Mic, Bot, Code2, FileText, History,
  ArrowRight, Shield, Zap, Languages, Settings, FolderOpen, Play
} from 'lucide-react';

const TYPE_WORDS = ['fullstack apps', 'resumes', 'code fixes', 'websites', 'learning plans', 'kuch bhi'];

const FEATURES = [
  {
    icon: MessageSquare, title: 'Deep-Thinking Chat', color: '#4b8bfc',
    desc: 'ChatGPT-style bubbles, typewriter replies aur "Deep analysing..." orb. Hinglish me bolo, Hinglish me jawab.',
  },
  {
    icon: Bot, title: 'Autonomous Agent', color: '#a142f4',
    desc: 'Plan banata hai, tools chalata hai, files likhta hai, bug fix karta hai, screenshots leta hai — sab khud.',
  },
  {
    icon: Code2, title: 'VS Code-Style IDE', color: '#18c2a8',
    desc: 'Monaco editor, file tree, terminal, tabs aur GitHub Copilot-style chat — poora coding workspace ek jagah.',
  },
  {
    icon: Mic, title: 'Perplexity-Style Voice', color: '#ff8a65',
    desc: 'Live waveform orb ke saath bolo — "resume bana do", "code explain karo". Hindi/Hinglish samajhta hai.',
  },
  {
    icon: FileText, title: 'Instant Resume Builder', color: '#f59e0b',
    desc: 'Chat me "resume bana do" bolo — data extract karke professional resume side preview me bana dega.',
  },
  {
    icon: History, title: 'Private History', color: '#34d399',
    desc: 'Saari baatein aapki machine ke SQLite me saved — koi cloud, koi tracking nahi. 100% private.',
  },
];

const TECH_ICONS = [
  { src: '/icons/tech/javascript.svg', name: 'JavaScript' },
  { src: '/icons/tech/typescript.svg', name: 'TypeScript' },
  { src: '/icons/tech/python.svg', name: 'Python' },
  { src: '/icons/tech/react.svg', name: 'React' },
  { src: '/icons/tech/nextdotjs.svg', name: 'Next.js' },
  { src: '/icons/tech/nodejs.svg', name: 'Node.js' },
  { src: '/icons/tech/html5.svg', name: 'HTML5' },
  { src: '/icons/tech/css3.svg', name: 'CSS3' },
  { src: '/icons/tech/tailwindcss.svg', name: 'Tailwind' },
  { src: '/icons/tech/docker.svg', name: 'Docker' },
  { src: '/icons/tech/git.svg', name: 'Git' },
  { src: '/icons/tech/mongodb.svg', name: 'MongoDB' },
  { src: '/icons/tech/postgresql.svg', name: 'PostgreSQL' },
  { src: '/icons/tech/redis.svg', name: 'Redis' },
  { src: '/icons/tech/go.svg', name: 'Go' },
  { src: '/icons/tech/rust.svg', name: 'Rust' },
  { src: '/icons/tech/java.svg', name: 'Java' },
  { src: '/icons/tech/php.svg', name: 'PHP' },
  { src: '/icons/tech/swift.svg', name: 'Swift' },
  { src: '/icons/tech/kotlin.svg', name: 'Kotlin' },
];

const MODELS = [
  { src: '/icons/brand/gemini.svg', name: 'Gemini Flash', tag: 'Primary — 1500 req/day free' },
  { src: '/icons/brand/githubcopilot.svg', name: 'Groq Llama 3', tag: 'Fastest fallback' },
  { src: '/icons/brand/openai.svg', name: 'DeepSeek & NVIDIA', tag: 'More fallbacks' },
  { src: '/icons/brand/vscodium.svg', name: 'Ollama Local', tag: '100% offline option' },
];

function Typewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = TYPE_WORDS[idx % TYPE_WORDS.length];
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1));
        if (text === current) setTimeout(() => setDeleting(true), 1600);
      } else {
        setText(current.slice(0, text.length - 1));
        if (text === '') { setDeleting(false); setIdx(i => i + 1); }
      }
    }, deleting ? 40 : 75);
    return () => clearTimeout(timeout);
  }, [text, deleting, idx]);

  return (
    <span className="gradient-text">
      {text}
      <span className="inline-block w-0.5 h-[0.95em] ml-1 align-middle animate-pulse" style={{ background: 'var(--color-primary)' }} />
    </span>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>AI-Dost — Free AI Developer Assistant</title>
        <meta name="description" content="AI-Dost: free AI chat, autonomous agent, VS Code-style IDE, voice assistant aur resume builder — sab 100% free." />
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4 md:px-8" style={{ background: 'rgba(15,17,23,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 14px var(--color-primary-glow)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg">AI-<span className="gradient-text">Dost</span></span>
          </div>
          <div className="ml-8 hidden md:flex items-center gap-6 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#agent" className="hover:text-white transition-colors">Agent</a>
            <a href="#tech" className="hover:text-white transition-colors">Tech</a>
            <a href="#models" className="hover:text-white transition-colors">Models</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 18px var(--color-primary-glow)' }}>
                Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <header className="relative pt-32 pb-20 px-4 md:px-8 text-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(600px at 50% -10%, rgba(75,139,252,0.14), transparent 65%), radial-gradient(500px at 85% 30%, rgba(161,66,244,0.1), transparent 60%)' }} />
          <div className="relative max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium mb-6" style={{ background: 'rgba(75,139,252,0.1)', border: '1px solid rgba(75,139,252,0.3)', color: 'var(--color-primary)' }}>
              <Zap className="w-3 h-3" /> v3.0 — 100% free, bilkul private
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl leading-tight">
              Aapka AI-Dost —<br />
              <Typewriter />
            </h1>
            <p className="mt-5 text-sm md:text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Chat, autonomous agent, VS Code-style IDE, voice assistant aur resume builder —
              sab ek jagah. Hinglish me baat karo, poora project banao.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold cursor-pointer hover:scale-[1.03] transition-transform" style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 8px 30px rgba(75,139,252,0.4)' }}>
                  <Play className="w-4 h-4" /> Start Free
                </button>
              </Link>
              <a href="#features">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold cursor-pointer hover:scale-[1.03] transition-transform" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                  Features dekho
                </button>
              </a>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {['No credit card', 'No cloud storage', 'Hindi / English / Hinglish', 'Open source'].map(f => (
                <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <Shield className="w-3 h-3" style={{ color: '#34d399' }} /> {f}
                </span>
              ))}
            </div>
          </div>

          {/* Hero visual: mini chat mock */}
          <div className="relative max-w-xl mx-auto mt-14 rounded-3xl p-5 glass-card" style={{ border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-bold">AI-Dost</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>online</span>
            </div>
            <div className="space-y-3 text-left">
              <div className="ml-auto max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs" style={{ background: 'rgba(161,66,244,0.12)', border: '1px solid rgba(161,66,244,0.2)', color: 'var(--color-text-primary)' }}>
                Bhai, ek MERN todo app bana do with auth
              </div>
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--color-primary)' }}>
                  <span className="w-3.5 h-3.5 inline-block rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                  Deep analysing...
                </span>
                Done bhai! 🎉 Backend, frontend, auth — sab likh diya. <span className="gradient-text font-semibold">12 files</span> banayi. Ab edit karo ya deploy karo!
              </div>
              <div className="max-w-[70%] px-3.5 py-2.5 rounded-2xl text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                ⚙️ Agent ne 5 tools chalaye: read → write → edit → git commit ✓
              </div>
            </div>
          </div>
        </header>

        {/* Features */}
        <section id="features" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl">Sab kuch, <span className="gradient-text">ek jagah</span></h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Har tool production-grade — par free.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl p-6 glass-card transition-transform hover:-translate-y-1" style={{ border: '1px solid var(--color-border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold mb-2">{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Agent section */}
        <section id="agent" className="px-4 md:px-8 py-16">
          <div className="max-w-4xl mx-auto rounded-3xl p-8 md:p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(75,139,252,0.08), rgba(161,66,244,0.08))', border: '1px solid rgba(75,139,252,0.2)' }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5 copilot-ghost" style={{ background: 'var(--gradient-primary)' }}>
              <Bot className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-display font-bold text-2xl md:text-4xl">Autonomous Agent —<br />aapka personal developer</h2>
            <p className="mt-4 text-sm max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Ek prompt do — agent plan banata hai, tools chalata hai (read, write, edit, terminal, git),
              bug find karta hai aur fix karta hai, poora project generate karta hai aur screenshot leke
              result dikhata hai.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              {['📋 Plan mode', '🔧 10+ tools', '👁️ Screenshots', '🐛 Bug find & fix', '⚡ One-prompt projects'].map(s => (
                <span key={s} className="text-[11px] px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Tech strip */}
        <section id="tech" className="px-4 md:px-8 py-16">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display font-bold text-2xl md:text-3xl mb-2">15+ languages samajhta hai</h2>
            <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>Monaco editor + full syntax highlighting</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {TECH_ICONS.map((t) => (
                <div key={t.name} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }} title={t.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.src} alt={t.name} className="w-5 h-5" />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Models */}
        <section id="models" className="px-4 md:px-8 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display font-bold text-2xl md:text-3xl">4+ AI models, <span className="gradient-text">ek smart cascade</span></h2>
              <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Ek model rate-limit ho jaye — agla turant try hota hai.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {MODELS.map((m) => (
                <div key={m.name} className="rounded-2xl p-5 text-center glass-card" style={{ border: '1px solid var(--color-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.src} alt={m.name} className="w-9 h-9 mx-auto mb-3" />
                  <div className="text-xs font-bold">{m.name}</div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{m.tag}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              <Settings className="w-3.5 h-3.5" /> Dashboard → Settings me saare keys manage karo
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 md:px-8 py-20 text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl">Chalo, shuru karte hain 🚀</h2>
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Free hai — aaj hi try karo. Koi signup nahi.</p>
          <Link href="/dashboard">
            <button className="mt-8 flex items-center gap-2 mx-auto px-8 py-4 rounded-2xl text-sm font-bold cursor-pointer hover:scale-[1.04] transition-transform" style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 10px 40px rgba(75,139,252,0.45)' }}>
              <FolderOpen className="w-4 h-4" /> Dashboard kholo <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <div className="mt-8 flex items-center justify-center gap-4 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1.5"><Languages className="w-3 h-3" /> Hindi • English • Hinglish</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> 100% local-first</span>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t px-4 md:px-8 py-8 text-center text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          AI-Dost v3.0 — free AI developer platform. 100% free APIs + local Ollama fallback. Made with ❤️ in India.
        </footer>
      </div>
    </>
  );
}