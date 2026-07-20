import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>Privacy Policy - Ai-Dost</title>
        <meta name="description" content="How Ai-Dost handles and protects your data" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-12 flex-1 max-w-4xl space-y-6 z-10">
        <h1 className="text-3xl font-bold text-primary">Privacy Policy</h1>
        
        <div className="space-y-4 text-text-secondary">
          <h2 className="text-xl font-semibold text-text-primary">1. Introduction</h2>
          <p>We are committed to protecting your personal information and data privacy.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">2. What Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account information (name, email, username)</li>
            <li>Project data and code</li>
            <li>Usage data and analytics</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-text-primary">3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide and improve our services</li>
            <li>Communicate with you</li>
            <li>Enhance security and prevent abuse</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-text-primary">4. Data Security</h2>
          <p>We use industry-standard encryption and security measures to protect your data.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">5. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data.</p>
          
          <h2 className="text-xl font-semibold text-text-primary">6. Changes to This Policy</h2>
          <p>We may update this policy periodically and will notify you of significant changes.</p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
