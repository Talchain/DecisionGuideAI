/**
 * TypedErrorRenderer — single component that renders every FailureType from
 * TurnExecutor addendum §2.1.5 with its declared user-visible outcome text.
 *
 * Slice A0 scope:
 *   - no design polish; plain semantic markup
 *   - no retry buttons (A1+ will wire retryable behaviour)
 *   - props accept either a full BoundaryError or an OlumiResponse error block
 */
import { type ReactElement } from 'react';
import {
  FAILURE_USER_TEXT,
  type FailureTypeLiteral,
  type BoundaryError,
} from '@talchain/schemas/boundary';

export interface TypedErrorRendererProps {
  code: FailureTypeLiteral;
  requestId?: string;
  severity?: 'info' | 'warn' | 'error';
  /** Optional — present when rendering a B1 BoundaryError (not a block). */
  boundaryError?: BoundaryError;
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
      return FAILURE_USER_TEXT[code];
    default: {
      // Exhaustiveness guard — see block comment above.
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

export function TypedErrorRenderer(props: TypedErrorRendererProps): ReactElement {
  const { code, requestId, severity = 'error', boundaryError } = props;
  const text = resolveUserText(code);

  return (
    <section
      role={severity === 'error' ? 'alert' : 'status'}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      data-testid="typed-error"
      data-error-code={code}
      data-severity={severity}
    >
      <p data-testid="typed-error-text">{text}</p>
      <p data-testid="typed-error-code" aria-label="error code">
        <code>{code}</code>
      </p>
      {requestId ? (
        <p data-testid="typed-error-request-id" aria-label="request id">
          <small>Request ID: {requestId}</small>
        </p>
      ) : null}
      {boundaryError ? (
        <details data-testid="typed-error-details">
          <summary>Technical details</summary>
          <pre>{JSON.stringify(boundaryError, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}

export default TypedErrorRenderer;
