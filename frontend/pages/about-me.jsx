import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AboutMe = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>About Me - Ai-Dost Creator</title>
        <meta name="description" content="Learn about the creator of Ai-Dost" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-12 flex-1 max-w-4xl space-y-6 z-10">
        <h1 className="text-3xl font-bold text-primary">About the Creator</h1>
        
        <div className="flex items-center space-x-6 bg-bg-hover p-6 rounded-xl border border-secondary/10">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-4xl border border-primary/30">
            👩‍💻
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Jane Developer</h2>
            <p className="text-text-secondary">Full-stack developer and AI enthusiast building tools for better software development.</p>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-text-primary">Background</h2>
        <p className="text-text-secondary">With over 8 years of experience in software development, I created Ai-Dost to solve common challenges in engineering workflows.</p>
        
        <h2 className="text-xl font-semibold text-text-primary">Vision</h2>
        <p className="text-text-secondary">To create an intelligent development environment that helps developers build better software faster.</p>
      </main>
      
      <Footer />
    </div>
  );
};

export default AboutMe;
