/**
 * TypedErrorRenderer — renders every FailureType with its canonical
 * user-visible text plus a code-specific guidance line and optional server
 * reason passthrough.
 *
 * v5-ui-exclusive-path brief (Phase 4):
 *   - Guidance line per non-retryable code (retryable errors carry a Try
 *     again chip on the message bubble instead — not rendered here).
 *   - Server reason passthrough: when BoundaryError.details.reason is a
 *     non-empty string, surface it beneath the canonical text. Never
 *     replace the canonical text; layering keeps the taxonomy visible.
 *   - No retry button — the chip on the parent message handles it.
 */
import { type ReactElement } from 'react'
import {
  FAILURE_USER_TEXT,
  type FailureTypeLiteral,
  type BoundaryError,
} from '@talchain/schemas/boundary'

import { extractReason, resolveGuidance } from './failureTypeRetryability'

export interface TypedErrorRendererProps {
  code: FailureTypeLiteral
  requestId?: string
  severity?: 'info' | 'warn' | 'error'
  /** Optional — present when rendering a B1 BoundaryError (not a block). */
  boundaryError?: BoundaryError
}

// Exhaustive switch over FailureType. If a new member is added to
// BoundaryErrorCode / FailureType, the default branch stops narrowing to
// `never` and TypeScript raises a compile error here — forcing the renderer
// to be updated before the new code can ship.
function resolveUserText(code: FailureTypeLiteral): string {
  switch (code) {
    case 'INGRESS_CONTRACT_VIOLATION':
    case 'EGRESS_CONTRACT_VIOLATION':
    case 'FEATURE_NOT_ENABLED':
    case 'TURN_BUDGET_EXCEEDED':
    case 'UPSTREAM_TIMEOUT':
    case 'UPSTREAM_UNAVAILABLE':
    case 'LLM_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return FAILURE_USER_TEXT[code]
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}

export function TypedErrorRenderer(props: TypedErrorRendererProps): ReactElement {
  const { code, requestId, severity = 'error', boundaryError } = props
  const text = resolveUserText(code)
  const guidance = resolveGuidance(code)
  const reason = extractReason(boundaryError)

  return (
    <section
      role={severity === 'error' ? 'alert' : 'status'}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      data-testid="typed-error"
      data-error-code={code}
      data-severity={severity}
    >
      <p data-testid="typed-error-text">{text}</p>
      {reason ? (
        <p data-testid="typed-error-reason">
          <small>{reason}</small>
        </p>
      ) : null}
      {guidance ? (
        <p data-testid="typed-error-guidance">{guidance}</p>
      ) : null}
      <p data-testid="typed-error-code" aria-label="error code">
        <code>{code}</code>
      </p>
      {requestId ? (
        <p data-testid="typed-error-request-id" aria-label="request id">
          <small>Request ID: {requestId}</small>
        </p>
      ) : null}
      {boundaryError && import.meta.env.DEV ? (
        // Raw details are DEV-only: CEE may place operator context
        // (request_id, validator names, internal reason strings) in
        // `details`. Gating prevents accidental leakage to production
        // users. The canonical user-facing text above is always shown.
        <details data-testid="typed-error-details">
          <summary>Technical details</summary>
          <pre>{JSON.stringify(boundaryError, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}

export default TypedErrorRenderer
