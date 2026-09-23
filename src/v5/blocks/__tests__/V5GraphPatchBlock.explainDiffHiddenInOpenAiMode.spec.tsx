/**
 * OpenAI mode never offers "Why these changes?" (RC Paul Test Candidate item 2,
 * #63 5800519725; routed by OpenAI Connected 5800958481 ask 3).
 *
 * The button calls `/bff/cee/explain-diff`, whose task capability list is
 * anthropic|fixtures — OpenAI `explainDiff` throws, so no config override can
 * make it OpenAI. It is a separate browser request, so the request-scoped
 * provider guard (#1749) cannot see or refuse it. In OpenAI mode the only
 * provider-pure closure is not to offer it.
 *
 * The mode is re-read from `window.location.href` on every render, exactly as
 * every send reads it (`aiComparisonMode.ts`), so both URL forms are driven:
 * the page-query form Paul's test URL uses and the hash form.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../../canvas/conversation/types'

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: unknown) => unknown) =>
    selector({
      nodes: [{ id: 'fac_team_morale', data: { label: 'team morale' } }],
      edges: [],
      analysisFreshness: { freshness: 'unknown' },
      analysisFreshnessDirty: false,
    }),
}))

import { V5GraphPatchBlock } from '../V5GraphPatchBlock'

const applied: V5GraphPatchBlockType = {
  type: 'v5_graph_patch',
  status: 'applied',
  operation: 'set_factor_value',
  target_id: 'fac_team_morale',
  before: { value: 0.5 },
  after: { value: 0.7 },
}

const ORIGINAL = window.location.href
const at = (pathAndQuery: string) => window.history.replaceState(null, '', pathAndQuery)

beforeEach(() => cleanup())
afterEach(() => window.history.replaceState(null, '', ORIGINAL))

describe('V5GraphPatchBlock — "Why these changes?" is not offered in OpenAI mode', () => {
  it('page-query form (?ai=openai#/canvas — Paul\'s test URL): no trigger, receipt still renders', () => {
    at('/?ai=openai#/canvas')
    render(<V5GraphPatchBlock block={applied} />)
    // Present control from the same render: the receipt itself.
    expect(screen.getByTestId('v5-change-receipt')).toBeInTheDocument()
    expect(screen.queryByTestId('explain-diff-trigger')).not.toBeInTheDocument()
  })

  it('hash form (#/canvas?ai=openai): no trigger', () => {
    at('/#/canvas?ai=openai')
    render(<V5GraphPatchBlock block={applied} />)
    expect(screen.getByTestId('v5-change-receipt')).toBeInTheDocument()
    expect(screen.queryByTestId('explain-diff-trigger')).not.toBeInTheDocument()
  })

  it('CONTRAST — conventional mode still offers it on the same applied receipt', () => {
    at('/?ai=conventional#/canvas')
    render(<V5GraphPatchBlock block={applied} />)
    expect(screen.getByTestId('explain-diff-trigger')).toBeInTheDocument()
  })

  it('CONTRAST — no mode in the URL (non-staging host) still offers it', () => {
    at('/#/canvas')
    render(<V5GraphPatchBlock block={applied} />)
    expect(screen.getByTestId('explain-diff-trigger')).toBeInTheDocument()
  })
})
