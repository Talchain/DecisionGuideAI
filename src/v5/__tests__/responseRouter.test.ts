import { describe, it, expect } from 'vitest';
import { OlumiResponseSchema, type OlumiResponse } from '@talchain/schemas/boundary';

import { routeV5Response } from '../responseRouter';

function baseResponse(overrides?: Partial<OlumiResponse>): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: 'hello',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  };
}

describe('routeV5Response', () => {
  it('routes plain assistant_text → text_only', () => {
    const t = routeV5Response({ kind: 'response', response: baseResponse() });
    expect(t.kind).toBe('text_only');
  });

  // ----------------------------------------------------------------------
  // Severity-aware error-block routing (P0 fix, 2026-05).
  // Only severity:'error' blocks are fatal. severity:'warn' / 'info'
  // blocks are advisory and do not override assistant_text.
  // ----------------------------------------------------------------------

  it('routes severity:error block → typed_error with block code', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        blocks: [{ type: 'error', error_code: 'FEATURE_NOT_ENABLED', severity: 'error' }],
      }),
    });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') expect(t.code).toBe('FEATURE_NOT_ENABLED');
  });

  it('severity:warn error block + friendly assistant_text + chip → text_only (recoverable, full content preserved)', () => {
    // This is the canonical CEE recoverable rejection shape: edit_graph
    // returns a friendly assistant_text plus a warn-level error block
    // carrying rejection diagnostics. Pre-fix this rendered as
    // "Something went wrong on our side." Post-fix the user sees the
    // friendly text and the recovery chip.
    //
    // This test isolates the recoverable-rendering contract that
    // downstream chat renderers depend on, without going through the
    // (currently flaky) useConversation hook suite. The renderer's
    // observable inputs are `result.response.assistant_text` and
    // `result.response.suggested_actions`; this test pins those plus
    // the diagnostic-side `result.response.blocks` warn-block survival.
    const friendlyText =
      "I wasn't able to make that change safely. Can you describe what you'd like to add or change in simpler terms?";
    const recoveryChip = {
      id: 'c',
      label: 'Describe what to change',
      message: 'Let me describe the change differently.',
    };
    const response = baseResponse({
      assistant_text: friendlyText,
      blocks: [
        {
          type: 'error',
          error_code: 'INTERNAL_ERROR',
          severity: 'warn',
          details: { source: 'edit_graph', rejection_code: 'STRUCTURAL_VALIDATION_FAILED' },
        },
      ],
      suggested_actions: [recoveryChip],
    });
    expect(() => OlumiResponseSchema.parse(response)).not.toThrow();

    const t = routeV5Response({ kind: 'response', response });
    expect(t.kind).toBe('text_only');
    if (t.kind === 'text_only') {
      // (a) Friendly assistant_text survives verbatim — the renderer
      // displays this in the chat bubble.
      expect(t.response.assistant_text).toBe(friendlyText);
      expect(t.response.assistant_text).not.toMatch(/Something went wrong/i);

      // (b) Recovery chip survives verbatim — the chip strip uses
      // suggested_actions[].label and .message directly.
      expect(t.response.suggested_actions).toEqual([recoveryChip]);

      // (c) Warn block is preserved on response.blocks so debug-panel /
      // telemetry consumers can still surface rejection_code.
      expect(t.response.blocks).toHaveLength(1);
      const warnBlock = t.response.blocks[0];
      expect(warnBlock).toMatchObject({
        type: 'error',
        severity: 'warn',
        error_code: 'INTERNAL_ERROR',
      });

      // (d) The user-facing legacy fatal copy must NOT appear anywhere
      // in the response payload; renderers that build their copy from
      // the response data alone will not surface it.
      expect(JSON.stringify(t.response)).not.toMatch(/Something went wrong/i);
    }
  });

  it('severity:info error block does not route to typed_error', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        blocks: [{ type: 'error', error_code: 'FEATURE_NOT_ENABLED', severity: 'info' }],
      }),
    });
    expect(t.kind).toBe('text_only');
  });

  it('severity:warn block alongside a non-error content block → blocks (the content block wins, warn ignored for routing)', () => {
    const response = baseResponse({
      assistant_text: '',
      blocks: [
        { type: 'text', content: 'see analysis' },
        { type: 'error', error_code: 'INTERNAL_ERROR', severity: 'warn' },
      ],
    });
    expect(() => OlumiResponseSchema.parse(response)).not.toThrow();
    const t = routeV5Response({ kind: 'response', response });
    expect(t.kind).toBe('blocks');
  });

  it('severity:error wins even when other content blocks are present', () => {
    const response = baseResponse({
      blocks: [
        { type: 'text', content: 'this would have been content' },
        { type: 'error', error_code: 'TURN_BUDGET_EXCEEDED', severity: 'error' },
      ],
    });
    expect(() => OlumiResponseSchema.parse(response)).not.toThrow();
    const t = routeV5Response({ kind: 'response', response });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') expect(t.code).toBe('TURN_BUDGET_EXCEEDED');
  });

  it('routes non-error block → blocks (block payload passes OlumiResponseSchema)', () => {
    // Canonical text-block field is `content` per @talchain/schemas/boundary
    // blocks.ts:7-9. Prove the whole response parses before asserting routing.
    const response = baseResponse({
      blocks: [{ type: 'text', content: 'hi' }],
    });
    expect(() => OlumiResponseSchema.parse(response)).not.toThrow();

    const t = routeV5Response({ kind: 'response', response });
    expect(t.kind).toBe('blocks');
  });

  it('routes BoundaryError → typed_error', () => {
    const t = routeV5Response({
      kind: 'boundary_error',
      error: {
        error: 'INGRESS_CONTRACT_VIOLATION',
        boundary: 'B1',
        direction: 'ingress',
        validator: 'OrchestratorTurnPayload',
        details: { issues: [] },
        request_id: 'r-1',
        retryable: false,
      },
    });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') {
      expect(t.code).toBe('INGRESS_CONTRACT_VIOLATION');
      expect(t.requestId).toBe('r-1');
    }
  });

  it('routes parse_error → typed_error INTERNAL_ERROR (parse failures remain diagnostic, not silent)', () => {
    const t = routeV5Response({ kind: 'parse_error', reason: 'x' });
    expect(t.kind).toBe('typed_error');
    if (t.kind === 'typed_error') expect(t.code).toBe('INTERNAL_ERROR');
  });

  it('routes empty-response (no text, no blocks, no chips) → empty', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({ assistant_text: '', blocks: [], suggested_actions: [] }),
    });
    expect(t.kind).toBe('empty');
  });

  it('treats whitespace-only assistant_text with no blocks/chips as empty', () => {
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({ assistant_text: '   ', blocks: [], suggested_actions: [] }),
    });
    expect(t.kind).toBe('empty');
  });

  it('routes text-empty but chips-present → empty (chips alone do not justify a blank bubble)', () => {
    // Chips without any text or blocks render under a blank text container,
    // which looks broken. Fall back to the no-response guidance; the UI
    // renderer preserves the original chips on the response if it wants to
    // layer them under the fallback.
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        assistant_text: '',
        blocks: [],
        suggested_actions: [{ id: 'c', label: 'Try this', message: 'try' }],
      }),
    });
    expect(t.kind).toBe('empty');
  });

  it('warn-only response with empty assistant_text and no content blocks → empty (warn does not produce content)', () => {
    // A warn block in isolation isn't user-facing content; without text or
    // chips, the response is functionally empty. The empty fallback renderer
    // can choose to surface the warn details if it wants to.
    const t = routeV5Response({
      kind: 'response',
      response: baseResponse({
        assistant_text: '',
        blocks: [{ type: 'error', error_code: 'INTERNAL_ERROR', severity: 'warn' }],
        suggested_actions: [],
      }),
    });
    expect(t.kind).toBe('empty');
  });
});
