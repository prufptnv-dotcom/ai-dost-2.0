import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>Terms and Conditions - Ai-Dost</title>
        <meta name="description" content="Legal terms governing the use of Ai-Dost platform" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-12 flex-1 max-w-4xl space-y-8 z-10">
        <h1 className="text-3xl font-bold text-primary">Terms and Conditions</h1>
        
        <div className="space-y-4 text-text-secondary">
          <h2 className="text-xl font-semibold text-text-primary">1. Introduction</h2>
          <p>Welcome to Ai-Dost! Please read these terms carefully before using our platform.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">2. User Responsibilities</h2>
          <p>You are responsible for all activities that occur under your account.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">3. Intellectual Property</h2>
          <p>All content and technology remains the property of Ai-Dost.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">4. Disclaimer</h2>
          <p>Our platform is provided &quot;as is&quot; without warranties of any kind.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">5. Termination</h2>
          <p>We reserve the right to terminate accounts that violate these terms.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">6. Changes to Terms</h2>
          <p>We may update these terms periodically without prior notice.</p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Terms;
