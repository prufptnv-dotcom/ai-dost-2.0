import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';
import { Brain, Terminal, Users, Zap, ArrowRight, Bot, Sparkles, Code2, Shield } from 'lucide-react';

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-bg-default text-text-primary relative overflow-hidden noise-overlay">
      <Head>
        <title>AI Dost - Your intelligent AI coding partner</title>
        <meta name="description" content="Build faster, find bugs instantly, and collaborate seamlessly with AI Dost." />
      </Head>

      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '4s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border-subtle backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="AI-Dost Logo" className="w-9 h-9 rounded-lg object-cover border border-primary/30 shadow-[0_0_12px_var(--color-primary-glow)]" />
            <span className="font-bold text-xl tracking-tight gradient-text">AI Dost</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="gradient-btn px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
              Open App <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <motion.div 
          className="text-center max-w-3xl mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Status Badge */}
          <motion.div variants={item} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-primary/30 text-primary text-sm font-medium mb-8 animate-shimmer relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors">
             <span className="relative z-10 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> v2.0 Now Available</span>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          </motion.div>

          <motion.h1 variants={item} className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            Your intelligent <br/>
            <span className="gradient-text">AI coding partner</span>
          </motion.h1>

          <motion.p variants={item} className="text-xl text-text-secondary mb-10 leading-relaxed max-w-2xl mx-auto">
            Build faster, find bugs instantly, and collaborate seamlessly with an AI that understands your entire codebase in real-time.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="gradient-btn px-8 py-4 rounded-xl font-medium text-lg inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 w-full sm:w-auto justify-center">
              Start Coding <Terminal className="w-5 h-5" />
            </Link>
            <Link href="#features" className="gradient-btn-ghost px-8 py-4 rounded-xl font-medium text-lg inline-flex items-center gap-2 w-full sm:w-auto justify-center transition-transform hover:scale-105 active:scale-95">
              View Features
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          id="features"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Feature 1 */}
          <motion.div variants={item} className="glass-card glass-card-hover gradient-border p-8 rounded-2xl group transition-all duration-300 hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary group-hover:text-primary transition-colors">Vector Memory</h3>
            <p className="text-text-secondary leading-relaxed">
              Instant context retrieval across millions of lines of code. AI Dost remembers everything you&apos;ve ever typed.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div variants={item} className="glass-card glass-card-hover gradient-border p-8 rounded-2xl group transition-all duration-300 hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary group-hover:text-secondary transition-colors">Secure Sandbox</h3>
            <p className="text-text-secondary leading-relaxed">
              Run and test generated code in isolated, containerized environments before applying them to your workspace.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div variants={item} className="glass-card glass-card-hover gradient-border p-8 rounded-2xl group transition-all duration-300 hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-text-primary group-hover:text-success transition-colors">Real-time Collab</h3>
            <p className="text-text-secondary leading-relaxed">
              Share your AI sessions with team members. Debug together, learn together, and ship faster.
            </p>
          </motion.div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
