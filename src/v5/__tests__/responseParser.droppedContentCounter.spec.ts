// @vitest-environment jsdom
/**
 * Parser wiring for the dropped-content counter — Track C Step 1 (D-5).
 *
 * Asserts that the defensive-hardening tolerance in parseV5Response
 * (truly-unknown blocks[] types dropped pre-validation) records each
 * dropped type into the session counter WITHOUT changing any existing
 * parser behaviour: the parse still succeeds, the `unknown_blocks`
 * sidecar (per-turn truth) is still emitted, and dropped != rendered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
  UNKNOWN_BLOCKS_KEY,
} from '../responseParser'
import {
  getDroppedContentSnapshot,
  _resetDroppedContentCounter,
} from '../../lib/droppedContentCounter'

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Minimal valid OlumiResponse body + blocks under test. */
function fixtureWithBlocks(blocks: unknown[]): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: '',
    blocks,
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  }
}

// Concrete-call ReturnType keeps the spy typed under tsconfig.ci.json
// (bare `ReturnType<typeof vi.spyOn>` collapses to MockInstance<unknown[], unknown>
// and fails assignment from the console.info overload).
function spyOnConsoleInfo() {
  return vi.spyOn(console, 'info').mockImplementation(() => {})
}

describe('parseV5Response — dropped-content counter wiring', () => {
  let infoSpy: ReturnType<typeof spyOnConsoleInfo>

  beforeEach(() => {
    _resetDroppedContentCounter()
    infoSpy = spyOnConsoleInfo()
  })

  afterEach(() => {
    infoSpy.mockRestore()
    _resetDroppedContentCounter()
  })

  it('records dropped unknown block types by type with counts; parse still succeeds', async () => {
    const result = await parseV5Response(
      makeResponse(
        fixtureWithBlocks([
          {
            type: 'analysis_result',
            summary: 'Option A leads.',
            leading_option_id: 'opt-a',
            win_probabilities: { 'opt-a': 0.72 },
          },
          { type: 'hologram_widget', payload: 'should-never-be-recorded' },
          { type: 'hologram_widget', payload: 'x' },
          { type: 'sentient_toast' },
        ]),
      ),
    )

    // Existing tolerance contract unchanged
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    const sidecar = (result.response as Record<string | symbol, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown>
    const unknownBlocks = sidecar[UNKNOWN_BLOCKS_KEY] as {
      types: string[]
      count: number
      by_type: Record<string, number>
    }
    expect(unknownBlocks.count).toBe(3)

    // New: session counter recorded the drops, type-keyed
    const snap = getDroppedContentSnapshot()
    expect(snap.total_dropped).toBe(3)
    const byType = Object.fromEntries(
      snap.entries.map((e) => [e.block_type, e.count]),
    )
    expect(byType).toEqual({ hologram_widget: 2, sentient_toast: 1 })
    for (const entry of snap.entries) {
      expect(entry.source).toBe('v5_response_parser')
      expect(entry.rationale).toBe('unknown_block_type_dropped_pre_validation')
    }

    // Privacy: no payload content ever reaches the counter
    expect(JSON.stringify(snap)).not.toContain('should-never-be-recorded')

    // console.info observability line fired (one per dropped type)
    const droppedLines = infoSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.includes('[dropped-content]'))
    expect(droppedLines).toHaveLength(2)
  })

  it('records nothing when every block type is known/tolerated', async () => {
    const result = await parseV5Response(
      makeResponse(
        fixtureWithBlocks([
          {
            type: 'analysis_result',
            summary: 'Option A leads.',
            leading_option_id: 'opt-a',
            win_probabilities: { 'opt-a': 0.72 },
          },
        ]),
      ),
    )
    expect(result.kind).toBe('response')
    expect(getDroppedContentSnapshot().total_dropped).toBe(0)
  })
})
