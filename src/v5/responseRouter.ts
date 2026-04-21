/**
 * Response router — pure function mapping a parsed V5 response to the
 * renderer it should drive.
 *
 * v5-ui-exclusive-path brief (Phase 3): `fall_through_v4` removed. V5 is
 * the exclusive CEE path when the flag is on; there is nowhere to fall back
 * to. Typed errors surface directly to the user.
 *
 * RenderTarget kinds:
 *   - 'text_only'  : response has assistant_text and no non-error blocks
 *   - 'blocks'     : response has one or more non-error blocks
 *   - 'empty'      : response has no assistant_text and no non-error blocks
 *                    (UI renders "No response received" fallback with retry)
 *   - 'typed_error': response contains an error block OR a BoundaryError
 *                    OR a parse_error
 */
import type { OlumiResponse, FailureTypeLiteral, BoundaryError } from '@talchain/schemas/boundary';

import type { V5CallResult } from './v5Adapter';

export type RenderTarget =
  | { kind: 'text_only'; response: OlumiResponse }
  | { kind: 'blocks'; response: OlumiResponse }
  | { kind: 'empty'; response: OlumiResponse }
  | {
      kind: 'typed_error';
      code: FailureTypeLiteral;
      requestId?: string;
      boundaryError?: BoundaryError;
    };

export function routeV5Response(result: V5CallResult): RenderTarget {
  if (result.kind === 'boundary_error') {
    return {
      kind: 'typed_error',
      code: result.error.error,
      requestId: result.error.request_id,
      boundaryError: result.error,
    };
  }
  if (result.kind === 'parse_error') {
    return { kind: 'typed_error', code: 'INTERNAL_ERROR' };
  }

  // Happy path: an OlumiResponse.
  const resp = result.response;
  const errorBlock = resp.blocks.find((b) => b.type === 'error');
  if (errorBlock && errorBlock.type === 'error') {
    return {
      kind: 'typed_error',
      code: errorBlock.error_code,
    };
  }

  const nonErrorBlocks = resp.blocks.filter((b) => b.type !== 'error');
  const hasText = resp.assistant_text.trim().length > 0;

  // Empty-response guard: no text, no non-error blocks. Suggested actions
  // alone don't disqualify the empty state — chips rendered under a blank
  // text bubble look broken. The UI's empty-fallback renderer attaches its
  // own retry chip; any suggested_actions that arrived are preserved on the
  // OlumiResponse so callers can surface them explicitly if they choose.
  if (!hasText && nonErrorBlocks.length === 0) {
    return { kind: 'empty', response: resp };
  }

  if (nonErrorBlocks.length === 0) {
    return { kind: 'text_only', response: resp };
  }
  return { kind: 'blocks', response: resp };
}
