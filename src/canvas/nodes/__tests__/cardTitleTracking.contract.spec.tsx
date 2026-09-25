/**
 * ⭐ CONTRACT `.node h3{letter-spacing:-.08px}` — every card title, repeated and
 * anchor alike.
 *
 * The locked visual contract (§02) sets the card title at
 * `13px / 1.25 / 610 / -0.08px`, with `.node.wide h3{font-size:14px}` for the
 * Question and Goal anchors. At `5f8d9095` the weight (610, #1971) and the
 * line-height (1.25, RHY-08) had landed; the letter-spacing had not — no card
 * title carried any tracking at all.
 *
 * The rule is on `.node h3`, so it binds the anchors too: `.node.wide h3`
 * overrides only the SIZE. This spec therefore asserts the tracking on every
 * card kind, and asserts separately that the anchors keep their 14px step —
 * the contrast that a naive "drop the title token to 13px" would break.
 *
 * ⚠ THE TRACKING CARRIES THE COUNTER-SCALE, LIKE THE SIZE BESIDE IT. Canvas type
 * is `declared × --canvas-label-scale` in node space so it reads at its declared
 * size on screen across the legible band (`utils/zoomLegibility.ts`). A bare
 * `-0.08px` would hold its node-space pixels while the glyphs it spaces doubled,
 * halving the tracking at the landing zoom. At scale 1 the value is exactly the
 * contract's `-0.08px`.
 *
 * ⚠ jsdom cannot see whether a class string becomes CSS — Tailwind's scanner
 * reads SOURCE TEXT, and an unscanned arbitrary class ships dark
 * (`typography.ts` header). So the last test compiles the REAL config against
 * the REAL `typography.ts` source and asserts the emitted declaration.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { resolve } from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import type { Config } from 'tailwindcss'
import { Target } from 'lucide-react'
// @ts-expect-error TS7016 — the root Tailwind config ships no declaration file;
// same pragma as `chartClassesCompile.spec.ts`.
import tailwindConfig from '../../../../tailwind.config.js'
import { BaseNode } from '../BaseNode'
import type { NodeType } from '../../domain/nodes'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null,
    useUpdateNodeInternals: () => vi.fn(),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

/** The contract's `-0.08px`, counter-scaled like the size token it sits beside. */
const TITLE_TRACKING_CLASS = 'tracking-[calc(-0.08px*var(--canvas-label-scale,1))]'
/** The anchors' `.node.wide h3{font-size:14px}` step, as the size token spells it. */
const ANCHOR_TITLE_SIZE_CLASS = 'text-[length:calc(14px*var(--canvas-label-scale,1))]'

const REPEATED: NodeType[] = ['factor', 'option', 'outcome', 'risk']
const ANCHORS: NodeType[] = ['decision', 'goal']

function renderTitle(nodeType: NodeType, label: string) {
  const { container } = render(
    <BaseNode
      id={`n-${nodeType}`}
      type={nodeType}
      selected={false}
      dragging={false}
      zIndex={0}
      isConnectable
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      deletable
      selectable
      draggable
      data={{ label }}
      nodeType={nodeType}
      icon={Target}
    />
  )
  const titles = container.querySelectorAll('[data-testid="node-title"]')
  // Identity, not a value predicate: exactly ONE title element, and it is the
  // one carrying this card's label.
  expect(titles.length, `${nodeType}: expected exactly one node-title element`).toBe(1)
  const title = titles[0] as HTMLElement
  expect(title.textContent).toBe(label)
  return title.className.split(/\s+/)
}

describe('card title letter-spacing is the contract -0.08px', () => {
  it.each(REPEATED)('%s (repeated card) title carries the contract tracking', (kind) => {
    expect(renderTitle(kind, `A ${kind} title`)).toContain(TITLE_TRACKING_CLASS)
  })

  it.each(ANCHORS)('%s (anchor) title carries it too — `.node h3` covers `.node.wide`', (kind) => {
    expect(renderTitle(kind, `A ${kind} title`)).toContain(TITLE_TRACKING_CLASS)
  })

  it.each(ANCHORS)('CONTRAST — the %s anchor title keeps its 14px `.node.wide h3` step', (kind) => {
    expect(renderTitle(kind, `A ${kind} title`)).toContain(ANCHOR_TITLE_SIZE_CLASS)
  })

  it('the tracking class compiles from the typography source to -0.08px at scale 1', async () => {
    const config: Config = {
      ...(tailwindConfig as Config),
      content: { files: [resolve(__dirname, '../../../styles/typography.ts')] },
    }
    const { css } = await postcss([tailwindcss(config)]).process('@tailwind utilities', { from: undefined })
    // POSITIVE CONTROL: the compile read the file (its size token is emitted).
    expect(css).toMatch(/font-size:\s*calc\(14px \* var\(--canvas-label-scale,1\)\)/)
    const rule = /\.tracking-\\\[calc\\\(-0\\\.08px\\\*var\\\(--canvas-label-scale\\2c 1\\\)\\\)\\\]\s*\{\s*letter-spacing:\s*([^;}]+)/.exec(css)
    expect(rule, 'the title tracking class emitted no CSS — it would ship dark').not.toBeNull()
    expect(rule![1].trim()).toBe('calc(-0.08px * var(--canvas-label-scale,1))')
  })
})
