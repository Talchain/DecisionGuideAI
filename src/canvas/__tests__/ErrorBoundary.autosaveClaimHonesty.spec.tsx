/**
 * FULL-ASSURANCE COPY — the crash panel may not promise a save it did not make.
 *
 * The canvas error panel printed, unconditionally:
 *
 *     "Your work is auto-saved. Reloading will restore your latest work."
 *
 * On the 2026-08-13 P0 that sentence was FALSE AT THE MOMENT IT WAS SHOWN, and
 * provably so:
 *
 *   · the store held CEE-shaped nodes/edges (no `position`, no `source`/`target`);
 *   · `crashFlush.isPlausibleNode` REQUIRES a finite `position.x`/`.y` and
 *     `isPlausibleEdge` REQUIRES string `source`/`target`, so every element was
 *     filtered out;
 *   · `flushWorkToAutosave` then hit `nodes.length === 0 && edges.length === 0`
 *     and returned **false WITHOUT WRITING** — deliberately, so an empty store
 *     cannot clobber the last good autosave;
 *   · `componentDidCatch` ALREADY captured that result in a local `flushed` and
 *     logged it as `flushedWorkToAutosave` — and then rendered the promise
 *     regardless.
 *
 * So the product asserted a guarantee about the user's data while holding, in
 * hand, the evidence that the guarantee did not hold. This is the same defect
 * class as the crash it sits under, one level up: the machinery to tell the
 * truth existed and was not consulted.
 *
 * THE RULE APPLIED: the product may describe what IT did; it may not assert
 * something it cannot support. So:
 *   · flush SUCCEEDED → the original sentence is true and is kept verbatim;
 *   · flush FAILED    → say what happened ("could not save your most recent
 *     changes") and do not promise a restore we cannot vouch for. It must not
 *     claim the work is LOST either — an older autosave may well exist, and
 *     `flushWorkToAutosave` deliberately preserved it.
 *
 * RED at pristine: the panel renders the promise in BOTH arms, so the
 * flush-failed case asserts a guarantee that is false.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CanvasErrorBoundary as ErrorBoundary } from '../ErrorBoundary'
import { registerCrashSnapshotProvider, __resetCrashSnapshotProviderForTests } from '../persist/crashFlush'
import ceeRow from '../hooks/__tests__/fixtures/cee-persisted-graph-wire-2026-08-12.json'

function Boom(): JSX.Element {
  throw new Error('canvas exploded')
}

const PROMISE = /Your work is auto-saved/i

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    localStorage.clear()
  } catch {
    /* jsdom without storage — the assertions below do not depend on it */
  }
})

describe('the crash panel does not promise a save that did not happen', () => {
  it('FLUSH FAILED (the P0 shape): does NOT claim the work is auto-saved', () => {
    // The exact condition of the P0: the store holds CEE-shaped elements, so
    // every plausibility gate rejects and the flush writes nothing.
    registerCrashSnapshotProvider(() => ({
      nodes: ceeRow.nodes as unknown[],
      edges: ceeRow.edges as unknown[],
      scenarioId: 'scenario-under-test',
      ceeAnalysisReady: undefined,
      selectedGoalNode: null,
      analysis: null,
      goalConstraints: null,
    }))

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    // The panel is up …
    expect(screen.getByText(/Something went wrong/i)).toBeTruthy()
    // … and it must NOT assert the guarantee.
    expect(screen.queryByText(PROMISE)).toBeNull()
    // It should say what actually happened, without claiming the work is gone.
    expect(screen.getByText(/could not save your most recent changes/i)).toBeTruthy()
  })

  it('FLUSH SUCCEEDED: keeps the original promise verbatim', () => {
    registerCrashSnapshotProvider(() => ({
      nodes: [
        { id: 'n1', type: 'factor', position: { x: 1, y: 2 }, data: { label: 'A' } },
      ] as unknown[],
      edges: [] as unknown[],
      scenarioId: 'scenario-under-test',
      ceeAnalysisReady: undefined,
      selectedGoalNode: null,
      analysis: null,
      goalConstraints: null,
    }))

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText(PROMISE)).toBeTruthy()
  })

  it('NO PROVIDER AT ALL (crash before the canvas store loaded): no promise', () => {
    __resetCrashSnapshotProviderForTests()

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.queryByText(PROMISE)).toBeNull()
  })
})
