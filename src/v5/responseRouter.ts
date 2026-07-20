/**
 * Response router — pure function mapping a parsed V5 response to the
 * renderer it should drive.
 *
 * v5-ui-exclusive-path brief (Phase 3): `fall_through_v4` removed. V5 is
 * the exclusive CEE path when the flag is on; there is nowhere to fall back
 * to. Typed errors surface directly to the user.
 *
 * Severity-aware error-block routing (P0 fix, 2026-05):
 *   Inline 200-response error blocks now honour `severity`. Only blocks with
 *   `severity: 'error'` route to `typed_error` (fatal banner). Blocks with
 *   `severity: 'warn'` or `severity: 'info'` are non-fatal advisory signals
 *   — the response is classified by its `assistant_text` / non-error blocks
 *   as if the warning block were not present, but the warning block is
 *   preserved on `response.blocks` so a downstream consumer can surface it.
 *   This stops CEE recoverable rejections (e.g. `edit_graph` rejection
 *   where CEE sends a friendly `assistant_text` and a recovery chip but
 *   ALSO emits a `warn` error block carrying `rejection_code` for
 *   diagnostics) from being mapped to "Something went wrong on our side."
 *
 *   Parse / network / proxy failures (`parse_error`, `boundary_error`) are
 *   structurally unusable and still route to `typed_error`. Only the inline
 *   error-block path honours severity.
 *
 * RenderTarget kinds:
 *   - 'text_only'  : response has assistant_text and no fatal/non-warn blocks
 *   - 'blocks'     : response has one or more non-error blocks
 *   - 'empty'      : response has no assistant_text and no non-error blocks
 *                    (UI renders "No response received" fallback with retry)
 *   - 'typed_error': response contains a FATAL error block (severity 'error')
 *                    OR a BoundaryError OR a parse_error
 */
import type { OlumiResponse, FailureTypeLiteral, BoundaryError } from '@talchain/schemas/boundary';

import type { V5CallResult } from './v5Adapter';

/**
 * Parse-failure metadata forwarded on typed_error targets that originated
 * from a `parse_error` (transcript honesty, trust item #3). A parse_error
 * means NO typed CEE body reached the UI — the failure may be pure
 * transport (proxy 504 `PROXY_UPSTREAM_TIMEOUT`, Netlify edge timeout HTML,
 * a thrown network TypeError). Consumers combine this with the absence of
 * any CEE recovery signal to render transport-honest copy ("your message
 * didn't go through") instead of the false server-fault claim
 * ("Something went wrong on our side").
 */
/**
 * Reduced 2026-07-20 to the one field anything actually reads. `httpStatus`,
 * `source` and `parseFailureKind` were written here and read NOWHERE — a
 * complete reader sweep across `src` (including co-located `__tests__`) and
 * `tests` found zero consumers, with the `network` read at
 * transportFailure.ts:85 as the positive control proving the sweep could see
 * a reader. The object is never spread, stringified, logged or attached to a
 * message, so there was no whole-object passthrough keeping them alive
 * either; useConversation only forwards it, and transportFailure reads
 * `network` alone. Debug export already reconstructs `parse_failure_kind`
 * independently from the raw CEE envelope
 * (components/debug/utils/exportBundle.ts), so diagnostics lose nothing.
 */
export interface TypedErrorTransportMeta {
  /**
   * True when the request never produced a response at all (fetch threw:
   * offline, DNS, CORS preflight). The strongest "didn't reach the server"
   * signal.
   */
  network: boolean;
}

export type RenderTarget =
  | { kind: 'text_only'; response: OlumiResponse }
  | { kind: 'blocks'; response: OlumiResponse }
  | { kind: 'empty'; response: OlumiResponse }
  | {
      kind: 'typed_error';
      code: FailureTypeLiteral;
      requestId?: string;
      boundaryError?: BoundaryError;
      /**
       * Raw non-2xx JSON body when the parse failed to be a BoundaryError.
       * 0.19.0 types the CEE error envelope (`CeeTypedErrorSchema`, root
       * export) with `retryable` + flat `recovery_suggestion` + nested
       * `recovery` — an envelope of THAT shape is not a BoundaryError, so
       * without this passthrough its typed recovery data would be dropped
       * here and the user shown a generic INTERNAL_ERROR. Consumers read it
       * defensively via ceeRecovery.extractCeeRecovery (fail closed).
       */
      rawBody?: unknown;
      /**
       * Present exactly when this typed_error came from a parse_error (no
       * BoundaryError envelope on the wire). See TypedErrorTransportMeta.
       */
      transportMeta?: TypedErrorTransportMeta;
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
    return {
      kind: 'typed_error',
      code: 'INTERNAL_ERROR',
      ...(result.raw !== undefined ? { rawBody: result.raw } : {}),
      transportMeta: {
        // The fetch-threw parse_error (v5Adapter catch) is the only one
        // with no http_status — every parseV5Response branch stamps one.
        network: result.http_status === undefined,
      },
    };
  }

  // Happy path: an OlumiResponse.
  const resp = result.response;

  // Severity-aware routing: only `severity: 'error'` blocks are fatal. `warn`
  // and `info` blocks are advisory — the response is classified by its
  // assistant_text / non-error blocks just as if the warning block were not
  // present. The warning block is left on `response.blocks` so downstream
  // consumers (debug panel, banner renderer) can still surface it. This
  // honours the boundary contract's `Severity = z.enum(['info','warn','error'])`
  // (olumi-schemas/src/boundary/enums.ts) instead of treating any error block
  // as fatal regardless of severity.
  const fatalErrorBlock = resp.blocks.find(
    (b) => b.type === 'error' && b.severity === 'error',
  );
  if (fatalErrorBlock && fatalErrorBlock.type === 'error') {
    return {
      kind: 'typed_error',
      code: fatalErrorBlock.error_code,
    };
  }

  // For classification, treat warn/info error blocks as non-blocking advisory
  // signals — they do NOT count as content, so a response with only an
  // assistant_text + a warn error block routes as `text_only` (the
  // assistant_text is the user-visible content). They also do not count as
  // non-error blocks for the `blocks` target.
  const contentBlocks = resp.blocks.filter((b) => b.type !== 'error');
  const hasText = resp.assistant_text.trim().length > 0;

  // Empty-response guard: no text, no non-error content blocks. Suggested
  // actions alone don't disqualify the empty state — chips rendered under a
  // blank text bubble look broken. The UI's empty-fallback renderer attaches
  // its own retry chip; any suggested_actions that arrived are preserved on
  // the OlumiResponse so callers can surface them explicitly if they choose.
  if (!hasText && contentBlocks.length === 0) {
    return { kind: 'empty', response: resp };
  }

  if (contentBlocks.length === 0) {
    return { kind: 'text_only', response: resp };
  }
  return { kind: 'blocks', response: resp };
}
