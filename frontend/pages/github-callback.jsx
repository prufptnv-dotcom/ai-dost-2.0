import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { githubAuth } from '../services/api';
import { useToast } from '../context/ToastContext';

const GitHubCallback = () => {
  const router = useRouter();
  const { code } = router.query;
  const [status, setStatus] = useState('Processing GitHub authentication...');
  const { showToast } = useToast();

  useEffect(() => {
    if (!code) return;

    const handleCallback = async () => {
      try {
        const response = await githubAuth(code);
        
        // Save token and user details to localStorage
        localStorage.setItem('ai_dost_token', response.token);
        localStorage.setItem('ai_dost_user_id', response.user.user_id);
        localStorage.setItem('ai_dost_user_name', response.user.name);
        
        showToast({ type: 'success', message: 'Successfully authenticated with GitHub!' });
        router.push('/dashboard');
      } catch (error) {
        console.error('GitHub authentication failed:', error);
        setStatus('Authentication failed. Please try again.');
        showToast({ type: 'error', message: 'GitHub auth failed' });
      }
    };

    handleCallback();
  }, [code, router]);

  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="text-4xl animate-spin">⚡</div>
        <h2 className="text-xl font-bold text-primary">{status}</h2>
        <p className="text-sm text-text-secondary">Please do not close this window.</p>
      </div>
    </div>
  );
};

export default GitHubCallback;
