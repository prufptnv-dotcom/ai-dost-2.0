import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex items-center justify-center">
      <div className="text-primary font-bold text-lg animate-pulse">Redirecting to Dashboard...</div>
    </div>
  );
}
