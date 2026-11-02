/**
 * S4 / canvas A B7: on the olumi-core lane the Model tab's outline is the View's cards in the View's order, each line its glyph and
 * heading as core wrote them, with no group headings (a card's `family` is an id; a heading made from it would be DGAI's words).
 * Bound by identity: each line's strings are the View's own at their paths. Off the lane the outline is today's, grouped by kind.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import type { View } from '../../../olumiView/client'
import { useViewStore } from '../../../olumiView/store'

function getMockState() {
  return {
    updateNode: vi.fn(), updateEdge: vi.fn(), ceePipelineTrace: null,
    highlightedNodes: new Set<string>(), highlightedEdges: new Set<string>(), setHighlightedNodes: vi.fn(), setHighlightedEdges: vi.fn(),
    currentScenarioId: null, lastServerGraphHash: null, currentStage: null, graphEditedSinceLastRun: false, rawV2Response: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn((selector: (s: unknown) => unknown) => selector(getMockState())), { getState: getMockState }),
}))
vi.mock('../GraphTextView', () => ({ SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../../model-tab-v2/ModelTabV2Panel', () => ({ ModelTabV2Panel: () => <div data-testid="model-tab-v2-panel" /> }))

import { ModelTabBody } from '../ModelTabBody'

const DIR = path.resolve('src/olumiView')
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const PROPS = {
  showDebug: false, hasDiagnostics: false, diagnostics: null, hasTrim: false, effectiveCorrelationId: null, correlationMismatch: false,
  correlationIdHeader: null, robustness: null, nodes: [] as Node[], edges: [] as Edge[],
}

beforeEach(() => useViewStore.setState({ view: null }))
afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ view: null }) })

describe('on the olumi-core lane the outline is the View', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })

  for (const n of GOLDEN) {
    it(`${n}: one line per card in the View's order, each its glyph and heading at their paths, and no other text`, () => {
      const view = golden(n), cards = view.model!.cards
      useViewStore.setState({ view })
      render(<ModelTabBody {...PROPS} />)
      expect(screen.queryByTestId('model-tab-v2-panel')).toBeNull()
      const outline = screen.getByTestId('view-outline')
      const lines = [...outline.querySelectorAll<HTMLElement>('[data-view-card]')]
      expect(lines.map((l) => l.dataset['viewCard'])).toEqual(cards.map((c) => c.id))
      lines.forEach((l, i) => {
        const c = cards[i]!
        expect(l.querySelector(`[data-view="${c.id}.glyph"]`)?.textContent).toBe(c.glyph)
        expect(l.querySelector(`[data-view="${c.id}.heading"]`)?.textContent).toBe(c.heading)
        expect(l.textContent!.replace(/\s+/g, '')).toBe(`${c.glyph}${c.heading}`.replace(/\s+/g, ''))
      })
      expect(outline.textContent!.replace(/\s+/g, '')).toBe(cards.map((c) => `${c.glyph}${c.heading}`).join('').replace(/\s+/g, ''))
    })
  }

  it('with no View yet there is no outline, and not the grouped one either', () => {
    render(<ModelTabBody {...PROPS} />)
    expect(screen.queryByTestId('view-outline')).toBeNull()
    expect(screen.queryByTestId('model-tab-v2-panel')).toBeNull()
  })
})

describe('off the lane the outline is as today', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '') })

  it('the grouped outline shows, and not the View outline, even with a View held', () => {
    useViewStore.setState({ view: golden('pricing') })
    render(<ModelTabBody {...PROPS} />)
    expect(screen.getByTestId('model-tab-v2-panel')).toBeTruthy()
    expect(screen.queryByTestId('view-outline')).toBeNull()
  })
})
