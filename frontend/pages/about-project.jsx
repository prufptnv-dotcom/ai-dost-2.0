import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AboutProject = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>About Project - Ai-Dost</title>
        <meta name="description" content="Learn about the Ai-Dost platform and its features" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-12 flex-1 max-w-4xl space-y-8 z-10">
        <h1 className="text-3xl font-bold text-primary">About Ai-Dost</h1>
        
        <div className="space-y-6 text-text-secondary">
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">What is Ai-Dost?</h2>
            <p>Ai-Dost is an intelligent engineering companion that helps developers plan, code, collaborate, and learn more effectively.</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Core Features</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>AI-powered code suggestions</li>
              <li>Real-time collaboration</li>
              <li>Integrated code execution</li>
              <li>Project memory and learning tracking</li>
              <li>Version history and diff tools</li>
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Technology Stack</h2>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">Python</span>
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">JavaScript</span>
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">React</span>
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">FastAPI</span>
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">MongoDB</span>
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-lg">Redis</span>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Why Use Ai-Dost?</h2>
            <p>Ai-Dost combines AI assistance with powerful development tools to help you build software faster and smarter.</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AboutProject;
