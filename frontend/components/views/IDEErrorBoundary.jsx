import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export default class IDEErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[IDE ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-canvas-base select-none">
          <AlertTriangle className="w-8 h-8 text-signal-error" />
          <p className="text-sm font-semibold text-paper-100 font-display">Workspace encountered a rendering issue</p>
          <p className="text-xs text-ink-muted max-w-md font-mono" style={{ wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={RefreshCw}
            onClick={() => this.setState({ error: null })}
          >
            Retry Workspace
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}