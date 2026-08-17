import React from 'react';

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
        <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ background: '#14161d', color: 'var(--color-text-muted)' }}>
          <span className="text-3xl">💥</span>
          <p className="text-sm font-semibold" style={{ color: '#f87171' }}>IDE crash ho gaya</p>
          <p className="text-[11px] max-w-md" style={{ wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-3 py-1.5 rounded-md text-[11px] font-bold cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}