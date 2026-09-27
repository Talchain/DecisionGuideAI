/**
 * Build train slice D-1a (root R7; thin-UI ruling #70 5855577789 rule 1):
 * the inspector says where a factor's value came from with the CARD'S answer,
 * not a second classification of its own.
 *
 * Before: `getExtractionLabel(source)` sent every literal it did not know to
 * "Estimated by Olumi", while the card's `factorValueSourceMark` marked the same
 * value "no source" (Codex #63 5801529767 — unknown stays unknown). One number,
 * two provenance claims, one of them invented.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})

import { factorValueSourceLabel, getExtractionLabel, getProvenanceLabel } from '../inspectorStrings'
import { factorValueSourceMark, VALUE_SOURCE_MARK_LABEL } from '../../../nodes/shared/valueSourceMark'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { useCanvasStore } from '../../../store'

/** The inspector's words for each of the card's mark kinds. */
const WORDS = {
  olumi: 'Estimated by Olumi',
  brief: 'From your brief',
  you: VALUE_SOURCE_MARK_LABEL.you,
  panel: VALUE_SOURCE_MARK_LABEL.panel,
  unknown: VALUE_SOURCE_MARK_LABEL.unknown,
} as const

const factor = (observedState: Record<string, unknown>) => ({ label: 'Pricing Level', kind: 'factor', observedState })

describe('D-1a — one classifier for a factor value\'s source', () => {
  it('⭐ an unrecognised source literal reads "Source not recorded", as the card marks it — never "Estimated by Olumi"', () => {
    const data = factor({ value: 0.8, source: 'template' })
    expect(factorValueSourceMark(data)?.kind).toBe('unknown') // the card
    expect(factorValueSourceLabel(data)).toBe('Source not recorded') // the inspector
    // The second classifier this replaces on the factor panels answered differently:
    expect(getExtractionLabel('template')).toBe('Estimated by Olumi')
  })

  it('CONTRAST — an Olumi estimate still reads "Estimated by Olumi"', () => {
    const data = factor({ value: 0.8, source: 'cee_inference' })
    expect(factorValueSourceMark(data)?.kind).toBe('olumi')
    expect(factorValueSourceLabel(data)).toBe('Estimated by Olumi')
  })

  it('the inspector agrees with the card on every shape the card distinguishes', () => {
    const shapes: Array<Record<string, unknown>> = [
      { value: 0.8, source: 'cee_inference' },
      { value: 0.8, source: 'brief_extraction' },
      { value: 0.8, source: 'cee_inference', extractionType: 'explicit' },
      { value: 0.8, source: 'cee_inference', extractionType: null }, // a withdrawn marker (edit awaiting receipt)
      { value: 0.8, source: 'brief_extraction', extractionType: null }, // N1: a brief value whose marker a person's edit withdrew (#2046 class)
      { value: 0.8, source: 'template' },
      { value: 0.8, source: 'default' },
      { value: 0.8 }, // no source at all
    ]
    for (const obs of shapes) {
      const data = factor(obs)
      const kind = factorValueSourceMark(data)?.kind ?? 'unknown'
      expect({ obs, label: factorValueSourceLabel(data) }).toEqual({ obs, label: WORDS[kind] })
    }
  })

  it('"ai-suggested" is Olumi\'s suggestion, not "from your brief"', () => {
    expect(getProvenanceLabel('ai-suggested')).toBe('Suggested by Olumi')
  })
})

describe('D-1a — the mounted inspector pill', () => {
  const NODE_ID = 'fac_pricing_level'
  const seed = (source: string) =>
    useCanvasStore.setState(
      {
        nodes: [{ id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { ...factor({ value: 0.8, raw_value: 0.8, cap: 1, display_value: '0.8', source }), factor_type: 'lever' } } as unknown as Node],
        edges: [],
        results: { status: 'idle', report: null },
      } as never,
      false,
    )
  const pill = (container: HTMLElement) => container.querySelector('[data-panel-group="context"]')?.textContent ?? ''

  beforeEach(() => {})
  afterEach(() => cleanup())

  it('⭐ an unrecognised source: the pill says "Source not recorded", as the card does', () => {
    seed('template')
    const { container } = render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(pill(container)).toContain('Source not recorded')
    expect(pill(container)).not.toContain('Estimated by Olumi')
  })

  it('⭐ N2 — the observable panel: a value with NO source reads "Source not recorded", as the card reads "no source"', () => {
    useCanvasStore.setState(
      {
        nodes: [{ id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Pricing Level', kind: 'factor', factor_type: 'observable', observedState: { value: 0.8, raw_value: 0.8, cap: 1, display_value: '0.8' } } } as unknown as Node],
        edges: [],
        results: { status: 'idle', report: null },
      } as never,
      false,
    )
    const { container } = render(<FactorObservablePanel nodeId={NODE_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(container.textContent).toContain('Source not recorded')
  })

  it('CONTRAST — an Olumi estimate: the pill says "Estimated by Olumi"', () => {
    seed('cee_inference')
    const { container } = render(<FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(pill(container)).toContain('Estimated by Olumi')
  })
})
