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
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-lg w-full text-center border border-red-500/20">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/10 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-400" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              An unexpected error occurred in the application interface.
            </p>
            
            {this.state.error && (
              <div className="bg-gray-950 p-4 rounded-lg text-left overflow-auto max-h-48 mb-6 border border-gray-700">
                <code className="text-sm text-red-400 block whitespace-pre-wrap font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-cyan-500/20"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
