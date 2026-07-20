import React from 'react';
import { AiOutlineCopyright } from 'react-icons/ai';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-bg-hover border-t border-secondary/10 p-8 mt-12 z-10 w-full">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap justify-center space-x-6">
            <a href="/" className="text-primary hover:text-primary/80 transition text-sm font-semibold">
              Home
            </a>
            <a href="/about-project" className="text-text-secondary hover:text-primary transition text-sm font-semibold">
              About Project
            </a>
            <a href="/privacy-policy" className="text-text-secondary hover:text-primary transition text-sm font-semibold">
              Privacy Policy
            </a>
            <a href="/terms" className="text-text-secondary hover:text-primary transition text-sm font-semibold">
              Terms
            </a>
          </div>
          <div className="flex items-center text-text-secondary text-xs">
            <AiOutlineCopyright className="mr-2 text-primary text-sm" />
            <span>{currentYear} Ai-Dost. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
