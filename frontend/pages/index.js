import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Footer from '../components/Footer';
import {
  Brain, Terminal, Users, Zap, ArrowRight, Bot, Sparkles,
  Code2, Shield, GitBranch, Cpu, Layers, ChevronRight,
  Star, Play, CheckCircle2
} from 'lucide-react';

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── Typewriter ─── */
function Typewriter({ words, speed = 80, pause = 1800 }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[idx % words.length];
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1));
        if (text === current) setTimeout(() => setDeleting(true), pause);
      } else {
        setText(current.slice(0, text.length - 1));
        if (text === '') { setDeleting(false); setIdx(i => i + 1); }
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [text, deleting, idx, words, speed, pause]);

  return (
    <span className="gradient-text">
      {text}
      <span className="inline-block w-0.5 h-[1em] ml-1 bg-gradient-to-b from-cyan-400 to-violet-500 align-middle animate-pulse" />
    </span>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ icon: Icon, color, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className="group relative glass-card rounded-2xl p-7 border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
    >
      {/* Glow behind card */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(400px at 50% 0%, ${color}15, transparent 70%)` }}
      />
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-text-primary group-hover:text-white transition-colors">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ─── Code Demo Preview ─── */
const codeLines = [
  { indent: 0, tokens: [{ t: 'async function', c: '#c792ea' }, { t: ' buildProject', c: '#82aaff' }, { t: '(prompt) {', c: '#89ddff' }] },
  { indent: 1, tokens: [{ t: 'const ', c: '#c792ea' }, { t: 'agent', c: '#f78c6c' }, { t: ' = ', c: '#89ddff' }, { t: 'new', c: '#c792ea' }, { t: ' AIDost()', c: '#82aaff' }] },
  { indent: 1, tokens: [{ t: 'await ', c: '#c792ea' }, { t: 'agent', c: '#f78c6c' }, { t: '.analyze(', c: '#89ddff' }, { t: 'prompt', c: '#f78c6c' }, { t: ')', c: '#89ddff' }] },
  { indent: 1, tokens: [{ t: 'await ', c: '#c792ea' }, { t: 'agent', c: '#f78c6c' }, { t: '.generateFiles()', c: '#82aaff' }] },
  { indent: 1, tokens: [{ t: 'await ', c: '#c792ea' }, { t: 'agent', c: '#f78c6c' }, { t: '.runTests()', c: '#82aaff' }] },
  { indent: 1, tokens: [{ t: 'return ', c: '#c792ea' }, { t: 'agent', c: '#f78c6c' }, { t: '.getResult()', c: '#82aaff' }] },
  { indent: 0, tokens: [{ t: '}', c: '#89ddff' }] },
];

function CodeDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= codeLines.length) return;
    const t = setTimeout(() => setVisibleLines(v => v + 1), 350);
    return () => clearTimeout(t);
  }, [visibleLines]);

  return (
    <div className="relative glass-card rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/2">
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs text-text-muted font-mono">ai-dost — agent.js</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">Agent Running</span>
        </div>
      </div>

      <div className="p-5 font-mono text-sm">
        {codeLines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 leading-7"
          >
            <span className="text-white/20 select-none w-4 text-right shrink-0">{i + 1}</span>
            <span style={{ paddingLeft: `${line.indent * 16}px` }}>
              {line.tokens.map((token, j) => (
                <span key={j} style={{ color: token.c }}>{token.t}</span>
              ))}
            </span>
          </motion.div>
        ))}

        {/* Cursor */}
        {visibleLines < codeLines.length && (
          <div className="flex items-center gap-3 leading-7">
            <span className="text-white/20 select-none w-4 text-right">{visibleLines + 1}</span>
            <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1 rounded-sm" />
          </div>
        )}
      </div>

      {/* Terminal output */}
      <div className="border-t border-white/5 bg-black/30 p-4 font-mono text-xs">
        <div className="flex items-center gap-2 text-green-400 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>✓ Files generated: index.html, style.css, app.py</span>
        </div>
        <div className="flex items-center gap-2 text-green-400 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>✓ Tests passed: 9/9</span>
        </div>
        <div className="flex items-center gap-2 text-cyan-400">
          <Zap className="w-3.5 h-3.5 animate-pulse" />
          <span>Agent completed in 1.9s</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  const features = [
    {
      icon: Brain,
      color: '#06b6d4',
      title: 'Vector Memory Brain',
      desc: 'Instant context retrieval across millions of lines. AI Dost remembers everything you\'ve ever typed.',
    },
    {
      icon: Bot,
      color: '#8b5cf6',
      title: 'Autonomous Agent',
      desc: 'Give one prompt — the agent plans, writes files, runs tests, and ships code. Zero manual steps.',
    },
    {
      icon: Shield,
      color: '#10b981',
      title: 'Secure Sandbox',
      desc: 'All generated code runs in isolated environments before touching your workspace.',
    },
    {
      icon: GitBranch,
      color: '#f59e0b',
      title: 'Local Git Control',
      desc: 'Timeline checkpoints, commits, and rollbacks built directly into the editor UI.',
    },
    {
      icon: Cpu,
      color: '#f472b6',
      title: 'Multi-Model Cascade',
      desc: 'Groq → NVIDIA → OpenRouter → Mistral. Auto-failover ensures 99.9% uptime.',
    },
    {
      icon: Layers,
      color: '#60a5fa',
      title: 'Real-time Collab',
      desc: 'Share your AI session with teammates. Debug together and ship 3× faster.',
    },
  ];

  const stats = [
    { value: 99, suffix: '.9%', label: 'Uptime' },
    { value: 9, suffix: '/9', label: 'Tests Passed' },
    { value: 1, suffix: '.9s', label: 'Avg Agent Speed' },
    { value: 6, suffix: '+', label: 'LLM Providers' },
  ];

  return (
    <div className="min-h-screen bg-[#05060a] text-text-primary relative overflow-hidden noise-overlay">
      <Head>
        <title>AI Dost — Autonomous AI Coding Partner</title>
        <meta name="description" content="Build faster with AI Dost — the autonomous AI coding partner that plans, writes, tests and ships code from a single prompt." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="AI Dost — Autonomous AI Coding Partner" />
        <meta property="og:description" content="One prompt. Full project. Ship faster with AI Dost." />
      </Head>

      {/* ── Background Orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] animate-float" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-fuchsia-500/5 blur-[140px] animate-float" style={{ animationDelay: '6s' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_40%,#000_60%,transparent_100%)]" />
      </div>

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div
            className="flex items-center justify-between h-14 px-5 rounded-2xl"
            style={{
              background: 'rgba(10,10,18,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.jpg"
                alt="AI-Dost"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg object-cover border border-cyan-500/30 shadow-[0_0_14px_rgba(6,182,212,0.3)]"
              />
              <span className="font-extrabold text-lg tracking-tight gradient-text">AI Dost</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {['Features', 'Agent Demo', 'Stats'].map(item => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(' ', '-')}`}
                  className="px-4 py-1.5 text-sm text-text-muted hover:text-text-primary rounded-lg hover:bg-white/5 transition-all"
                >
                  {item}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="gradient-btn px-5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
              >
                Open App <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-36 pb-24">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Left: Text */}
            <div className="flex-1 text-center lg:text-left">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-sm font-medium"
                style={{
                  background: 'rgba(6,182,212,0.08)',
                  border: '1px solid rgba(6,182,212,0.25)',
                  color: '#22d3ee',
                }}
              >
                <Sparkles className="w-4 h-4" />
                <span>v2.0 — Autonomous Agent Mode Live</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.1] mb-6"
              >
                Your intelligent<br />
                <Typewriter
                  words={['AI coding partner', 'autonomous agent', 'code generator', 'bug hunter', 'project builder']}
                />
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-text-secondary leading-relaxed mb-10 max-w-xl"
              >
                Give one prompt. AI Dost plans, writes code, runs tests, and ships your project — fully autonomously. No babysitting required.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
              >
                <Link
                  href="/dashboard"
                  className="gradient-btn px-8 py-4 rounded-xl font-semibold text-base inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform w-full sm:w-auto justify-center"
                >
                  <Terminal className="w-5 h-5" />
                  Start Coding Free
                </Link>
                <a
                  href="#agent-demo"
                  className="gradient-btn-ghost px-8 py-4 rounded-xl font-semibold text-base inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform w-full sm:w-auto justify-center"
                >
                  <Play className="w-5 h-5" />
                  Watch Agent Demo
                </a>
              </motion.div>

              {/* Social proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-10 flex items-center gap-3"
              >
                <div className="flex -space-x-2">
                  {['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-[#05060a] flex items-center justify-center text-xs font-bold"
                      style={{ background: `${c}30`, color: c }}
                    >
                      {['VK', 'AI', 'JS', 'RX'][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-text-muted">
                  <span className="text-text-primary font-semibold">500+</span> developers shipping faster
                </div>
                <div className="flex items-center gap-0.5 ml-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: Code demo */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex-1 w-full max-w-lg"
            >
              <CodeDemo />
            </motion.div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section id="stats" className="border-y border-white/5 bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="text-4xl font-black gradient-text mb-1">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-sm text-text-muted">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-cyan-400 tracking-widest uppercase mb-3">Everything you need</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Built for <span className="gradient-text">serious builders</span>
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Every feature is designed to help you move faster — from idea to shipped product.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 0.08} />
            ))}
          </div>
        </section>

        {/* ── Agent Demo Section ── */}
        <section id="agent-demo" className="max-w-7xl mx-auto px-4 sm:px-6 pb-28">
          <div className="rounded-3xl overflow-hidden relative" style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(139,92,246,0.06))',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div className="px-8 py-16 md:px-16 flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-400 tracking-widest uppercase mb-3">One prompt. Full project.</p>
                <h2 className="text-4xl font-black tracking-tight mb-6">
                  Watch the agent<br />
                  <span className="gradient-text">build live</span>
                </h2>
                <ul className="space-y-3 mb-8">
                  {[
                    'Analyzes your prompt & plans tasks',
                    'Creates all files autonomously',
                    'Runs tests & fixes bugs itself',
                    'Delivers in under 2 seconds',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-text-secondary">
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className="gradient-btn px-7 py-3.5 rounded-xl font-semibold inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
                >
                  Try Agent Now <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="flex-1 w-full max-w-md">
                <div className="glass-card rounded-2xl p-5 font-mono text-xs space-y-2 border border-white/8">
                  {[
                    { icon: '📝', color: 'text-cyan-400', text: 'Prompt received: "build a calculator app"' },
                    { icon: '🔍', color: 'text-violet-400', text: 'Analyzing → generating 5-step task plan...' },
                    { icon: '📁', color: 'text-yellow-400', text: 'Creating: index.html, style.css, app.py' },
                    { icon: '⚡', color: 'text-green-400', text: 'Running tests → 9/9 passed ✓' },
                    { icon: '🚀', color: 'text-cyan-400', text: 'Project ready in 1.9s' },
                  ].map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-2"
                    >
                      <span>{log.icon}</span>
                      <span className={log.color}>{log.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="rounded-3xl p-14"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.12), rgba(244,114,182,0.08))',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Sparkles className="w-10 h-10 mx-auto mb-6 text-cyan-400" />
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
                Ready to ship <span className="gradient-text">10× faster?</span>
              </h2>
              <p className="text-text-secondary mb-10 max-w-lg mx-auto text-lg">
                Join developers who have replaced hours of boilerplate with a single AI prompt.
              </p>
              <Link
                href="/dashboard"
                className="gradient-btn px-10 py-4 rounded-xl font-bold text-lg inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
              >
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
