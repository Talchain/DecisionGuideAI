/**
 * TypedErrorRenderer — one render per FailureType from addendum §2.1.5.
 * Asserts the declared user-visible text appears for each code.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FAILURE_USER_TEXT,
  FailureType,
  type FailureTypeLiteral,
} from '@talchain/schemas/boundary';

import { TypedErrorRenderer } from '../TypedErrorRenderer';

describe('TypedErrorRenderer — one render per FailureType', () => {
  const codes = FailureType.options as readonly FailureTypeLiteral[];

  it('enumerates all eight failure types', () => {
    expect(codes.length).toBe(8);
  });

  for (const code of codes) {
    it(`renders declared user-visible text for ${code}`, () => {
      render(<TypedErrorRenderer code={code} />);
      const text = FAILURE_USER_TEXT[code];
      expect(screen.getByTestId('typed-error-text').textContent).toBe(text);
      expect(screen.getByTestId('typed-error-code').textContent).toContain(code);
      expect(screen.getByTestId('typed-error').getAttribute('data-error-code')).toBe(code);
    });
  }

  it('includes request id when provided', () => {
    render(<TypedErrorRenderer code="INGRESS_CONTRACT_VIOLATION" requestId="req-42" />);
    expect(screen.getByTestId('typed-error-request-id').textContent).toContain('req-42');
  });

  it('omits request id when not provided', () => {
    render(<TypedErrorRenderer code="INTERNAL_ERROR" />);
    expect(screen.queryByTestId('typed-error-request-id')).toBeNull();
  });

  it('uses role=status (aria-live polite) when severity=info', () => {
    render(<TypedErrorRenderer code="FEATURE_NOT_ENABLED" severity="info" />);
    const el = screen.getByTestId('typed-error');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
});

describe('TypedErrorRenderer — Phase 4 retryability + reason passthrough', () => {
  it.each([
    ['INGRESS_CONTRACT_VIOLATION'],
    ['EGRESS_CONTRACT_VIOLATION'],
    ['FEATURE_NOT_ENABLED'],
    ['TURN_BUDGET_EXCEEDED'],
  ] as const)('renders code-specific guidance line for non-retryable code %s', (code) => {
    render(<TypedErrorRenderer code={code} />);
    const guidance = screen.getByTestId('typed-error-guidance');
    expect(guidance.textContent?.length).toBeGreaterThan(0);
  });

  it.each([
    ['UPSTREAM_TIMEOUT'],
    ['UPSTREAM_UNAVAILABLE'],
    ['LLM_UNAVAILABLE'],
    ['INTERNAL_ERROR'],
  ] as const)('omits guidance line for retryable code %s (Try again chip handles UX)', (code) => {
    render(<TypedErrorRenderer code={code} />);
    expect(screen.queryByTestId('typed-error-guidance')).toBeNull();
  });

  it('surfaces server details.reason beneath the canonical text', () => {
    render(
      <TypedErrorRenderer
        code="INTERNAL_ERROR"
        boundaryError={{
          error: 'INTERNAL_ERROR',
          boundary: 'B3',
          direction: 'egress',
          validator: 'x',
          details: { reason: 'plot run exceeded 120s' },
          request_id: 'req-9',
          retryable: true,
        }}
      />,
    );
    const reason = screen.getByTestId('typed-error-reason');
    expect(reason.textContent).toContain('plot run exceeded 120s');
  });

  it('omits reason element when details.reason is missing or non-string', () => {
    render(
      <TypedErrorRenderer
        code="INTERNAL_ERROR"
        boundaryError={{
          error: 'INTERNAL_ERROR',
          boundary: 'B3',
          direction: 'egress',
          validator: 'x',
          details: {},
          request_id: 'req-9',
          retryable: true,
        }}
      />,
    );
    expect(screen.queryByTestId('typed-error-reason')).toBeNull();
  });

  it('does NOT replace canonical text with reason; both co-exist when reason present', () => {
    render(
      <TypedErrorRenderer
        code="UPSTREAM_TIMEOUT"
        boundaryError={{
          error: 'UPSTREAM_TIMEOUT',
          boundary: 'B4',
          direction: 'egress',
          validator: 'plot_run_v2',
          details: { reason: 'PLoT did not return within 120s' },
          request_id: 'req-1',
          retryable: true,
        }}
      />,
    );
    const canonical = screen.getByTestId('typed-error-text');
    const reason = screen.getByTestId('typed-error-reason');
    expect(canonical.textContent?.length).toBeGreaterThan(0);
    expect(canonical.textContent).not.toContain('PLoT did not return');
    expect(reason.textContent).toContain('PLoT did not return');
  });

  it('no retry button rendered — the chip on the message bubble handles retry UX', () => {
    render(<TypedErrorRenderer code="UPSTREAM_TIMEOUT" />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });
});
