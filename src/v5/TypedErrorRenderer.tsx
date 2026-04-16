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

export function TypedErrorRenderer(props: TypedErrorRendererProps): ReactElement {
  const { code, requestId, severity = 'error', boundaryError } = props;
  const text = FAILURE_USER_TEXT[code] ?? code;

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
