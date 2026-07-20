import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>Page Not Found - Ai-Dost</title>
        <meta name="description" content="The requested page could not be found" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center items-center z-10">
        <h1 className="text-6xl font-extrabold text-primary mb-6">404</h1>
        <p className="text-xl text-text-secondary mb-8">The page you're looking for doesn't exist.</p>
        <a href="/" className="px-6 py-3.5 bg-primary text-bg-default font-extrabold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition duration-300">
          Return to Homepage
        </a>
      </main>
      
      <Footer />
    </div>
  );
};

export default NotFound;
