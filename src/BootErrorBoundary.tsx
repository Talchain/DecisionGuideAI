/**
 * The boundary around the top-level `AppPoC` lazy import.
 *
 * ⭐ THIS IS THE ONE THAT CATCHES A MID-SESSION DEPLOY. `AppPoC` is the FIRST
 * content-hashed chunk that can fail, so when a user's page was loaded before a
 * deploy and the build has moved underneath it, the failure lands HERE — above
 * `CanvasErrorBoundary`, which never sees it.
 *
 * It used to be chunk-blind, rendering "Render Error ❌ / Something went wrong.
 * Please refresh the page or contact support." That was untrue (nothing failed
 * to render; the build moved) and a dead end (no action, no automatic
 * recovery). The detector, the sentence and the rate-limited reload all come
 * from `src/lib/staleBuildRecovery.ts` — the single writer — so this boundary
 * and the canvas one cannot drift into saying different things.
 *
 * ⚠ EXTRACTED FROM `main.tsx` DELIBERATELY, AND THE REASON IS EVIDENCE, NOT
 * TIDINESS. While it lived in `main.tsx` it could not be rendered by a test:
 * that module self-boots on import. The only available assertion was that the
 * copy constants APPEARED in the file — and a mutation that made the branch
 * unreachable (`if (false)`) kept every one of those assertions green while the
 * user could never see the notice. A guard that binds to text rather than to
 * behaviour is not a guard. `src/__tests__/BootErrorBoundary.staleBuild.spec.tsx`
 * now mounts it and drives a real chunk error.
 */
import { Component, ReactNode } from 'react'
import {
  attemptStaleBuildReload,
  isChunkLoadError,
  reloadForCurrentBuild,
  STALE_BUILD_ACTION_COPY,
  STALE_BUILD_NOTICE_COPY,
} from './lib/staleBuildRecovery'

interface Props {
  children: ReactNode
  /** Boot-time logger, injected so this module has no dependency on main.tsx. */
  onError?: (message: string, data?: unknown) => void
}

interface State {
  error: Error | null
}

export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      if (typeof window !== 'undefined' && window.__SAFE_DEBUG__) {
        window.__SAFE_DEBUG__.fatal = String(error?.stack || error)
      }
    } catch {
      // Debug capture must never be the thing that breaks the error path.
    }

    this.props.onError?.('error-boundary:caught', {
      error: error.message,
      stack: error.stack,
      componentStack: info?.componentStack?.slice(0, 600),
      isChunkLoadError: isChunkLoadError(error),
    })

    // One rate-limited reload; the guard lives in the shared module so this
    // boundary and the canvas one share a single budget.
    if (isChunkLoadError(error)) {
      attemptStaleBuildReload()
    }
  }

  render() {
    const { error } = this.state

    if (error && isChunkLoadError(error)) {
      // Reached when the automatic reload was already spent (see the guard
      // window). The next reload is the user's decision — the product does not
      // silently retry forever.
      return (
        <div
          role="alert"
          data-testid="stale-build-notice"
          style={{
            padding: 16,
            background: 'var(--info-light, #BAD7E4)',
            color: 'var(--text-primary, #262626)',
            fontFamily: 'ui-sans-serif,system-ui,sans-serif',
            fontSize: 14,
            borderRadius: 8,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6 }}>Olumi was updated</strong>
          <p style={{ margin: '0 0 12px' }}>{STALE_BUILD_NOTICE_COPY}</p>
          <button
            type="button"
            onClick={reloadForCurrentBuild}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--info, #277A9D)',
              background: 'var(--info, #277A9D)',
              color: 'var(--text-on-color, #FFFFFF)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {STALE_BUILD_ACTION_COPY}
          </button>
        </div>
      )
    }

    if (error) {
      return (
        <div
          data-testid="boot-render-error"
          style={{
            padding: 12,
            background: 'var(--danger-light, #FFB393)',
            color: 'var(--text-primary, #262626)',
            fontFamily: 'ui-monospace,monospace',
            fontSize: 13,
            borderRadius: 8,
          }}
        >
          <strong>Render Error ❌</strong>
          {/* Only show error details in DEV to avoid exposing stack traces in production */}
          {import.meta.env.DEV ? (
            <>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12 }}>
                {error.message}
              </pre>
              {error.stack && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.75 }}>Stack trace</summary>
                  <pre style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{error.stack}</pre>
                </details>
              )}
            </>
          ) : (
            <p style={{ marginTop: 8 }}>
              Something went wrong. Please refresh the page or contact support.
            </p>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default BootErrorBoundary
