/**
 * V4 regression smoke — asserts that the V5 slice A0 scaffold cannot alter
 * the V4 turn flow when VITE_ENABLE_V5_ORCHESTRATOR is unset or 'false'.
 *
 * Why this narrow scope:
 *   - A0 deliberately does NOT edit useConversation.ts (3106 lines). The
 *     adapter's own `isV5Enabled()` gate returns `fall_through_v4` when the
 *     flag is off, so a caller that *would* branch through v5Adapter still
 *     falls all the way back to the V4 path without any code change.
 *   - This test pins that invariant: no matter what the UI scaffold does,
 *     with the flag off it must produce `fall_through_v4` and perform zero
 *     network calls. That is enough to guarantee V4 is unaffected by A0.
 *
 * A1 will add the actual entry-point branch to useConversation.ts, at which
 * point a richer smoke test (byte-identical V4 request/response) will
 * replace this one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { callV5Turn } from '../../../v5/v5Adapter';

const validPayload = {
  turn_id: '11111111-1111-4111-8111-111111111111',
  scenario_id: '22222222-2222-4222-8222-222222222222',
  message: 'hello',
  turn_class: 'frame' as const,
  stage: 'frame' as const,
};

describe('V4 regression smoke — V5 scaffold is inert with flag off', () => {
  const originalFlag = import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR;

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = originalFlag;
    vi.restoreAllMocks();
  });

  it('flag unset → callV5Turn returns fall_through_v4 with zero fetches', async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR;
    const fetchImpl = vi.fn();
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('fall_through_v4');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('flag=false → callV5Turn returns fall_through_v4 with zero fetches', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = 'false';
    const fetchImpl = vi.fn();
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('fall_through_v4');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('flag=anything-else → callV5Turn still falls through (only "true" enables)', async () => {
    (import.meta.env as Record<string, unknown>).VITE_ENABLE_V5_ORCHESTRATOR = '1';
    const fetchImpl = vi.fn();
    const res = await callV5Turn(validPayload, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.kind).toBe('fall_through_v4');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
