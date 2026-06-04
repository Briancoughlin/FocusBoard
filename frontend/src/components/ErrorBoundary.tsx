import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('FocusBoard caught an error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      localStorage.clear();
    } catch {}
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState(s => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg, #1a1a2e)',
          color: 'var(--text, #e0e0e0)',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          gap: '1rem',
        }}
      >
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>Something went wrong</div>
        <p style={{ color: 'var(--text-secondary, #999)', maxWidth: '420px', textAlign: 'center', margin: 0 }}>
          FocusBoard hit an unexpected error. Your data is safe — a reload should fix things.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--accent, #0078d4)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Reload app
          </button>
          <button
            onClick={this.handleClearAndReload}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              border: '1px solid var(--border, #333)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary, #999)',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Clear data &amp; reload
          </button>
        </div>

        <button
          onClick={this.toggleDetails}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #666)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            textDecoration: 'underline',
            marginTop: '0.25rem',
          }}
        >
          {this.state.showDetails ? 'Hide details' : 'Show error details'}
        </button>

        {this.state.showDetails && this.state.error && (
          <pre
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'var(--surface, #111)',
              border: '1px solid var(--border, #333)',
              color: 'var(--text-secondary, #999)',
              fontSize: '0.75rem',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.toString()}
            {this.state.error.stack ? '\n\n' + this.state.error.stack : ''}
          </pre>
        )}
      </div>
    );
  }
}
