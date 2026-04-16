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
