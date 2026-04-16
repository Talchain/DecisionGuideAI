/**
 * Response router — pure function mapping a parsed V5 response to the
 * renderer it should drive.
 *
 * Slice A0 scope:
 *   - 'text_only' : response has assistant_text and no blocks (or only info blocks)
 *   - 'blocks'    : response has non-error blocks (A1+ renderer work; A0 stubs)
 *   - 'typed_error' : response contains an error block OR a BoundaryError OR a parse_error
 */
import type { OlumiResponse, FailureTypeLiteral } from '@talchain/schemas/boundary';

import type { V5CallResult } from './v5Adapter';

export type RenderTarget =
  | { kind: 'text_only'; response: OlumiResponse }
  | { kind: 'blocks'; response: OlumiResponse }
  | {
      kind: 'typed_error';
      code: FailureTypeLiteral;
      requestId?: string;
      boundaryError?: unknown;
    }
  | { kind: 'fall_through_v4' };

export function routeV5Response(result: V5CallResult): RenderTarget {
  if (result.kind === 'fall_through_v4') {
    return { kind: 'fall_through_v4' };
  }
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
  if (nonErrorBlocks.length === 0) {
    return { kind: 'text_only', response: resp };
  }
  return { kind: 'blocks', response: resp };
}
