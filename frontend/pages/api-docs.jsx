import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ApiDocs = () => {
  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col justify-between pt-24">
      <Head>
        <title>API Docs - Ai-Dost API Endpoints</title>
        <meta name="description" content="Documentation for Ai-Dost REST API endpoints" />
      </Head>
      
      <Header />
      
      <main className="container mx-auto px-6 py-12 flex-1 max-w-4xl space-y-10 z-10">
        <h1 className="text-3xl font-bold text-primary">API Documentation</h1>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Authentication</h2>
            <div className="space-y-4 pl-4 border-l border-secondary/20">
              <div>
                <h3 className="text-lg font-bold text-primary">POST /auth/login</h3>
                <pre className="bg-bg-hover text-text-secondary p-4 rounded-xl border border-secondary/10 overflow-x-auto text-xs mt-2">{
                  JSON.stringify({
                    username: "string",
                    password: "string"
                  }, null, 2)
                }</pre>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-primary">POST /auth/register</h3>
                <pre className="bg-bg-hover text-text-secondary p-4 rounded-xl border border-secondary/10 overflow-x-auto text-xs mt-2">{
                  JSON.stringify({
                    name: "string",
                    password: "string",
                    skill_level: "string",
                    github_username: "string"
                  }, null, 2)
                }</pre>
              </div>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Project Management</h2>
            <div className="space-y-4 pl-4 border-l border-secondary/20">
              <div>
                <h3 className="text-lg font-bold text-primary">POST /api/v1/memory/project</h3>
                <pre className="bg-bg-hover text-text-secondary p-4 rounded-xl border border-secondary/10 overflow-x-auto text-xs mt-2">{
                  JSON.stringify({
                    project_name: "string",
                    description: "string"
                  }, null, 2)
                }</pre>
              </div>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-3">File Operations</h2>
            <div className="space-y-4 pl-4 border-l border-secondary/20">
              <div>
                <h3 className="text-lg font-bold text-primary">POST /api/v1/memory/project/&#123;project_id&#125;/file</h3>
                <pre className="bg-bg-hover text-text-secondary p-4 rounded-xl border border-secondary/10 overflow-x-auto text-xs mt-2">{
                  JSON.stringify({
                    file_path: "string",
                    content: "string"
                  }, null, 2)
                }</pre>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ApiDocs;
