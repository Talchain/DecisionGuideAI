/**
 * ⛔ NO WIN SHARE (Paul 21 Oct; Codex #2889 r1 blocker 1): CEE's OPTION_OUTCOME_WORDS must survive the real chain
 * (applyV5State with the whole store → useResultsSectionData's warning adapter), not only a hand-built
 * `inferenceWarnings`. The adapter rebuilds every warning field by field; before it carried `options`, a valid record
 * read as none. Served envelope: the RT-19 near-tie Run (`ts2-near-tie-target-ask.json`), once as served (CONTROL: no
 * record) and once with the record CEE #3572 adds beside the licence.
 */
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { optionOutcomeReading, readOptionOutcomeWords } from '../utils/optionOutcomeWords'
import fixture from './fixtures/ts2-near-tie-target-ask.json'

type Rec = Record<string, any>
const WORDS = [
  { option_id: 'option_a', words: 'With the data provided, Option A most likely gives about £48k a month (likely £41k–£55k a month).' },
  { option_id: 'option_b', words: 'With the data provided, Option B most likely gives about £46k a month (likely £40k–£53k a month).' },
]
const OVERLAP = "Their likely ranges overlap, so this model can't clearly separate them."

function hydrate(record: Rec | null): ReturnType<typeof useResultsSectionData> {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: fixture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label } })),
    edges: [],
  } as never)
  const env = structuredClone(fixture.envelope) as Rec
  if (record) env.blocks[0].enrichment.inference_warnings.push(record)
  const snapshot = useCanvasStore.getState()
  applyV5State(env as unknown as OlumiResponse, { ...snapshot, currentResultsHash: snapshot.results?.hash ?? null } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results?.report).toBeTruthy() // PRECONDITION: the turn wrote the report
  return renderHook(() => useResultsSectionData()).result.current
}

describe('OPTION_OUTCOME_WORDS survives the warning adapter', () => {
  it('CONTROL (as served, no record): no words are read', () => {
    const data = hydrate(null)
    expect((data.confidence.inferenceWarnings ?? []).length).toBeGreaterThan(0) // PRECONDITION: the adapter ran on real warnings
    expect(readOptionOutcomeWords(data.confidence.inferenceWarnings)).toBeNull()
  })

  it('with CEE\'s record: every option sentence, then the separation sentence, verbatim', () => {
    const data = hydrate({ code: 'OPTION_OUTCOME_WORDS', severity: 'info', message: OVERLAP, options: WORDS, separation: 'overlap' })
    expect(optionOutcomeReading(readOptionOutcomeWords(data.confidence.inferenceWarnings))).toBe(`${WORDS[0].words} ${WORDS[1].words} ${OVERLAP}`)
  })

  it('a single ranged option (CEE message \'\', kept as sent) still reads its sentence', () => {
    const data = hydrate({ code: 'OPTION_OUTCOME_WORDS', severity: 'info', message: '', options: [WORDS[0]], separation: null })
    expect(optionOutcomeReading(readOptionOutcomeWords(data.confidence.inferenceWarnings))).toBe(WORDS[0].words)
  })

  // ⛔ MALFORMED READS AS NONE THROUGH THE ADAPTER TOO (Codex #2889 r2): it must not coerce a bad message into a good one.
  it.each([['a number', 3], ['zero', 0], ['false', false], ['null', null], ['missing', undefined]])('message %s → none', (_, message) => {
    const record: Rec = { code: 'OPTION_OUTCOME_WORDS', severity: 'info', options: WORDS, separation: 'overlap' }
    if (message !== undefined) record.message = message
    const data = hydrate(record)
    expect(readOptionOutcomeWords(data.confidence.inferenceWarnings)).toBeNull()
  })
})
