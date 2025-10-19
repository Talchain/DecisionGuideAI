import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null; info?: ErrorInfo | null; show: boolean };

export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null, show: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      where: 'CanvasErrorBoundary',
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
      href: location.href,
      ts: Date.now(),
    };
    (window as any).__SAFE_DEBUG__ ||= { logs: [] };
    (window as any).__SAFE_DEBUG__.fatal = JSON.stringify(payload, null, 2);
    console.error('[CanvasErrorBoundary]', payload);
    this.setState({ info });
  }

  private copy = async () => {
    const fatal = (window as any).__SAFE_DEBUG__?.fatal || 'no fatal payload';
    try { await navigator.clipboard?.writeText(fatal); } catch {}
    this.setState({ show: true });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding: 12, fontFamily: 'ui-monospace,monospace' }}>
        <h3>Something went wrong</h3>
        <p>The canvas encountered an unexpected error.</p>

        <div style={{ marginTop: 12 }}>
          <button onClick={this.copy}>Copy Diagnostics</button>
          <button onClick={() => this.setState(s => ({ ...s, show: !s.show }))} style={{ marginLeft: 8 }}>
            {this.state.show ? 'Hide details' : 'Show details'}
          </button>
        </div>

        {this.state.show && (
          <details open style={{ marginTop: 8 }}>
            <summary>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {(window as any).__SAFE_DEBUG__?.fatal ||
               JSON.stringify(
                 {
                   message: this.state.error?.message,
                   stack: this.state.error?.stack,
                   componentStack: this.state.info?.componentStack
                 },
                 null,
                 2
               )}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
