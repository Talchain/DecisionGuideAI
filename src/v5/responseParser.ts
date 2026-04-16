/**
 * V5 response parser — validates raw fetch responses against the
 * OlumiResponse schema from @talchain/schemas/boundary. Fails closed to a
 * typed error result; never throws past this boundary.
 *
 * Slice A0 scope:
 *   - parse(Response) → V5ParseResult
 *   - no streaming, no retry, no telemetry, no chip/block rendering
 */
import {
  OlumiResponseSchema,
  BoundaryErrorSchema,
  type OlumiResponse,
  type BoundaryError,
} from '@talchain/schemas/boundary';

export type V5ParseResult =
  | { kind: 'response'; response: OlumiResponse }
  | { kind: 'boundary_error'; error: BoundaryError }
  | { kind: 'parse_error'; reason: string; http_status?: number; raw?: unknown };

export async function parseV5Response(res: Response): Promise<V5ParseResult> {
  let raw: unknown;
  try {
    raw = await res.json();
  } catch (e) {
    return {
      kind: 'parse_error',
      reason: `non-json response body (${(e as Error).message})`,
      http_status: res.status,
    };
  }

  // A typed BoundaryError is returned with a non-2xx status (e.g. 422).
  if (!res.ok) {
    const asError = BoundaryErrorSchema.safeParse(raw);
    if (asError.success) {
      return { kind: 'boundary_error', error: asError.data };
    }
    return {
      kind: 'parse_error',
      reason: `non-ok status ${res.status} and body is not a BoundaryError`,
      http_status: res.status,
      raw,
    };
  }

  // 2xx path: must parse as OlumiResponse.
  const parsed = OlumiResponseSchema.safeParse(raw);
  if (parsed.success) {
    return { kind: 'response', response: parsed.data };
  }
  return {
    kind: 'parse_error',
    reason: 'body did not match OlumiResponse schema',
    http_status: res.status,
    raw,
  };
}
