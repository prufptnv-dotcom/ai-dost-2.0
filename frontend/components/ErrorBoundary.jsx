import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg-default)' }}>
          <div className="p-8 rounded-xl shadow-2xl max-w-lg w-full text-center" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full" style={{ background: 'rgba(248,113,113,0.1)' }}>
                <AlertCircle className="w-12 h-12" style={{ color: 'var(--color-warning)' }} />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>UI Crashed</h1>
            <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              An unexpected error occurred in the React tree. Don&apos;t worry, your backend and workspace are safe.
            </p>
            
            {this.state.error && (
              <div className="p-4 rounded-lg text-left overflow-auto max-h-48 mb-6" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)' }}>
                <code className="text-sm block whitespace-pre-wrap font-mono" style={{ color: 'var(--color-warning)' }}>
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors font-medium cursor-pointer hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              >
                Try to Recover
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg cursor-pointer hover:opacity-90"
                style={{ background: 'var(--gradient-primary)', color: '#fff' }}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
