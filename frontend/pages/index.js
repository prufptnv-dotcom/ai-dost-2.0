import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between overflow-hidden">
      <Head>
        <title>Ai-Dost - Your Personal Engineering Partner</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Decorative gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-secondary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="text-2xl font-bold text-primary flex items-center">
          🤖 Ai-Dost
        </div>
        <Link href="/dashboard" className="px-5 py-2.5 bg-primary/10 border border-primary/30 text-primary font-semibold rounded-lg hover:bg-primary hover:text-bg-default transition duration-300 text-sm">
          Go to Dashboard
        </Link>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-block px-3 py-1 bg-secondary/15 border border-secondary/30 rounded-full text-xs font-bold text-primary uppercase tracking-widest">
            Revolutionizing Coding workflows
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
            Meet <span className="text-primary bg-clip-text">Ai-Dost</span>, your smart engineering buddy.
          </h1>
          <p className="text-base md:text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
            Chat with AI, index documentation to semantic vector memory, execute and test code in secure sandboxes, and collaborate in real-time.
          </p>

          <div className="pt-4 flex justify-center space-x-4">
            <Link href="/dashboard" className="px-8 py-3.5 bg-primary text-bg-default font-extrabold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition duration-300 text-base cursor-pointer">
              Launch Application
            </Link>
            <a href="https://github.com" className="px-8 py-3.5 bg-bg-hover border border-secondary/20 text-text-primary rounded-lg hover:bg-secondary/10 transition duration-300 text-base">
              Learn More
            </a>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mt-20 text-left">
          <div className="p-6 bg-bg-hover border border-secondary/10 rounded-xl">
            <div className="text-3xl mb-3">🧠</div>
            <h3 className="text-lg font-bold text-primary mb-2">Vector Memory</h3>
            <p className="text-sm text-text-secondary">ChromaDB semantic storage retrieves user learning history and past project code for deep context alignment.</p>
          </div>
          <div className="p-6 bg-bg-hover border border-secondary/10 rounded-xl">
            <div className="text-3xl mb-3">💻</div>
            <h3 className="text-lg font-bold text-primary mb-2">Secure Sandbox</h3>
            <p className="text-sm text-text-secondary">Isolated Docker containers execute Python, JS, and Go scripts securely with automatic timeout controls.</p>
          </div>
          <div className="p-6 bg-bg-hover border border-secondary/10 rounded-xl">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-bold text-primary mb-2">Real-time Collab</h3>
            <p className="text-sm text-text-secondary">Websocket-based project channels synchronize multi-user cursor changes and collaborative live sessions.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
