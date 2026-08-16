/**
 * useStageAwarePlaceholder — L-17 (the selection branch is gone) and L-42 (the
 * composer is the LOWEST staleness voice).
 *
 * Both changes are about the composer no longer impersonating something:
 *   · it stopped impersonating a prepared, submittable sentence about the
 *     selection (there was no way to send it — the composer's value was empty);
 *   · it stopped being the third surface telling the user to re-run.
 *
 * Every case names the OTHER placeholder it must fall through to, so a
 * suppression that accidentally blanked the composer would fail here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStageAwarePlaceholder } from '../../hooks/useStageAwarePlaceholder'
import { useCanvasStore } from '../../store'
import { claimStalenessVoice, __resetStalenessVoicesForTest } from '../stalenessVoice'

const NODE = {
  id: 'fac_a',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Hiring spend' },
}

function setStore(patch: Record<string, unknown>) {
  useCanvasStore.setState(patch as never)
}

beforeEach(() => {
  __resetStalenessVoicesForTest()
  setStore({
    nodes: [],
    edges: [],
    selection: null,
    results: { status: 'idle' },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  })
})

describe('L-17 — a selection no longer writes a fake sentence into the composer', () => {
  it('keeps the neutral model prompt while a node is selected', () => {
    setStore({
      nodes: [NODE],
      selection: { nodeIds: new Set([NODE.id]), edgeIds: new Set<string>() },
    })
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).toBe('Ask about this model…')
    expect(result.current).not.toContain('Hiring spend')
  })

  it('OPPOSITE TWIN — with nothing selected it is the same neutral prompt', () => {
    setStore({ nodes: [NODE] })
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).toBe('Ask about this model…')
  })

  it('still says "Describe your decision…" on an empty canvas', () => {
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).toBe('Describe your decision…')
  })
})

describe('L-42 — the composer is the lowest staleness voice', () => {
  /**
   * The 'changed' semantic, built from the keys `useAnalysisTrust` ACTUALLY
   * reads (derived at its bytes: `analysisFreshness` + `analysisFreshnessDirty`
   * + `results.status` + `importPendingServerRegistration`) — not from this
   * lane's guess at what the state ought to look like. A self-authored fixture
   * outside the producer's real domain proves nothing about the wire
   * (platform trap 16-inverse), and the first version of this fixture was
   * exactly that: it invented a `graphEditedSinceLastRun` key nothing reads,
   * and the "positive control" failed rather than passing vacuously — which is
   * the only reason it was caught here rather than shipped.
   */
  function setChangedState() {
    setStore({
      nodes: [NODE],
      results: { status: 'complete' },
      analysisFreshness: { freshness: 'stale' },
      analysisFreshnessDirty: false,
      importPendingServerRegistration: false,
    })
  }

  it('nags when NOTHING above it is speaking (positive control)', () => {
    setChangedState()
    const { result } = renderHook(() => useStageAwarePlaceholder())
    // Either the composer owns the nag, or the state under test never reached
    // 'changed' — assert the former explicitly so this control cannot pass
    // vacuously.
    expect(result.current).toBe('Model changed. Ask or rerun…')
  })

  it('goes NEUTRAL while the applied-edit card is saying it', () => {
    setChangedState()
    claimStalenessVoice('card')
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).not.toBe('Model changed. Ask or rerun…')
    // Falls through to the next honest thing, never to blank.
    expect(result.current).toBe('Ask about this analysis…')
  })

  it('goes NEUTRAL while the freshness pill is saying it', () => {
    setChangedState()
    claimStalenessVoice('pill')
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).toBe('Ask about this analysis…')
  })

  it('resumes the moment the higher voice leaves the screen', () => {
    setChangedState()
    const release = claimStalenessVoice('card')
    release()
    const { result } = renderHook(() => useStageAwarePlaceholder())
    expect(result.current).toBe('Model changed. Ask or rerun…')
  })
})
