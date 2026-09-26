/**
 * ⛔ A FRESH AI-DRAFTED VALUE READS AS OLUMI'S ESTIMATE, NOT "no source".
 *
 * Served on the final tuple (UI `b017e3c2` · CEE `9417228`), reviewer
 * 5827605617: four first-pass factor values rendered **"no source"** while the
 * assistant called every one of them an Olumi assumption. The bytes (AI
 * Quality's capture `evidence/ai-quality-20260925/quality-captures/B-openai/
 * turns.jsonl`, line 1, `developer_delivery_capacity`) carry
 * `observed_state.source: "cee_inference"`, node `provenance: "ai_inferred"`, and
 * **no `extractionType` key at all**.
 *
 * `factorValueSourceMark`'s rule 4 read `cee_inference` without an extraction
 * marker as the trace a person's IN-FLIGHT edit leaves, and marked it `unknown`.
 * But the two shapes are not the same bytes:
 * - the writer (`setObservedValue`, and `applyV5State`'s set-factor-value path)
 *   WITHDRAWS the marker: the `extractionType` key is PRESENT, set to
 *   `undefined`;
 * - the producer never wrote one: the key is ABSENT.
 *
 * Every case drives the REAL mapper (`mapDraftNodeToCanvas`), the REAL store
 * and the REAL writer (`useNodeMutations().setObservedValue`). The fixture is
 * the served node, byte for byte.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../../store'
import { mapDraftNodeToCanvas } from '../../../utils/applyDraftResult'
import { useNodeMutations } from '../../../ui/inspector-v2/useInspectorMutations'
import { factorValueSourceMark } from '../valueSourceMark'

/** The served node, exactly (CEE `9417228`, B-openai turns.jsonl line 1). */
const SERVED_AI_DRAFT_NODE = {
  id: 'developer_delivery_capacity',
  kind: 'factor',
  label: 'Developer delivery capacity',
  provenance: 'ai_inferred',
  observed_state: { unit: 'FTE', value: 0.25, source: 'cee_inference', raw_value: 5 },
}

function seedFromDraft(draftNode: Record<string, unknown> = SERVED_AI_DRAFT_NODE) {
  useCanvasStore.setState(
    {
      nodes: [{ ...mapDraftNodeToCanvas(draftNode as never), position: { x: 0, y: 0 } }],
      edges: [],
    } as never,
    false,
  )
}

const data = () => useCanvasStore.getState().nodes.find((n) => n.id === SERVED_AI_DRAFT_NODE.id)!.data

describe('a fresh AI-drafted value (no extractionType key) is marked as Olumi’s estimate', () => {
  beforeEach(() => seedFromDraft())

  it('⭐ the served first-pass node reads `olumi`, not `unknown`', () => {
    // PRECONDITION: the mapped node really has no extraction marker, at either level.
    const d = data() as Record<string, unknown>
    const obs = d.observedState as Record<string, unknown>
    expect('extractionType' in obs).toBe(false)
    expect('extractionType' in d).toBe(false)
    expect(obs.source).toBe('cee_inference')

    expect(factorValueSourceMark(d)?.kind).toBe('olumi')
  })

  it('the value and unit are carried through untouched', () => {
    const obs = (data() as { observedState: Record<string, unknown> }).observedState
    expect(obs).toMatchObject({ value: 0.25, raw_value: 5, unit: 'FTE', source: 'cee_inference' })
  })

  it('CONTRAST — a person’s in-flight edit (the real writer) makes NO claim yet: `unknown`, never `olumi` or `you`', () => {
    const { result } = renderHook(() => useNodeMutations(SERVED_AI_DRAFT_NODE.id))
    act(() => {
      result.current.setObservedValue(0.4, 8)
    })
    const d = data() as Record<string, unknown>
    // The writer's own trace: the key is PRESENT and withdrawn, the old source kept.
    expect('extractionType' in (d.observedState as Record<string, unknown>)).toBe(true)
    expect((d.observedState as Record<string, unknown>).source).toBe('cee_inference')
    expect(factorValueSourceMark(d)?.kind).toBe('unknown')
  })

  it('after the receipt stamps the person’s source, it reads `you`', () => {
    const { result } = renderHook(() => useNodeMutations(SERVED_AI_DRAFT_NODE.id))
    act(() => {
      result.current.setObservedValue(0.4, 8, { source: 'user_override' })
    })
    expect(factorValueSourceMark(data())?.kind).toBe('you')
  })

  it('a reload of the server’s bytes after the edit landed reads `you`; before it landed, `olumi`', () => {
    seedFromDraft({
      ...SERVED_AI_DRAFT_NODE,
      observed_state: { ...SERVED_AI_DRAFT_NODE.observed_state, value: 0.4, raw_value: 8, source: 'user_override' },
    })
    expect(factorValueSourceMark(data())?.kind).toBe('you')

    seedFromDraft()
    expect(factorValueSourceMark(data())?.kind).toBe('olumi')
  })

  it('CONTRAST — the producer’s explicit marker still decides: `inferred` → `olumi`, `explicit` → `brief`', () => {
    seedFromDraft({ ...SERVED_AI_DRAFT_NODE, observed_state: { ...SERVED_AI_DRAFT_NODE.observed_state, extractionType: 'inferred' } })
    expect(factorValueSourceMark(data())?.kind).toBe('olumi')
    seedFromDraft({ ...SERVED_AI_DRAFT_NODE, observed_state: { ...SERVED_AI_DRAFT_NODE.observed_state, source: 'brief_extraction', extractionType: 'explicit' } })
    expect(factorValueSourceMark(data())?.kind).toBe('brief')
  })

  it('CONTRAST — an unrecognised or missing source stays `unknown` (never relabelled as Olumi’s)', () => {
    seedFromDraft({ ...SERVED_AI_DRAFT_NODE, observed_state: { unit: 'FTE', value: 0.25, raw_value: 5 } })
    expect(factorValueSourceMark(data())?.kind).toBe('unknown')
    seedFromDraft({ ...SERVED_AI_DRAFT_NODE, observed_state: { ...SERVED_AI_DRAFT_NODE.observed_state, source: 'mystery_source' } })
    expect(factorValueSourceMark(data())?.kind).toBe('unknown')
  })
})
