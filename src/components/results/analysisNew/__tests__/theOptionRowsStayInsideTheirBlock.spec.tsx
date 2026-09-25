/**
 * ⭐ THE OPTION NAMES STAY INSIDE THEIR BLOCK.
 *
 * Served witness on `7e256bd3` (24 Sep 2026, 1440×900, OpenAI pricing run):
 * `analysis-new-options` measured scrollWidth 386 against clientWidth 382.
 * Each option-name button (`analysis-new-options-focus`) is `flex-1` with a
 * hanging `-mx-1 px-1`, so it grew to the row's width and then hung 4px past
 * BOTH edges; the right-hand 4px made the block scroll sideways. jsdom cannot
 * measure layout, so this pins the cause: the hang is on the left only, where
 * it lines the text up with its hover ground, and the right edge is flush.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)

describe('the option names stay inside their block', () => {
  it('no option-name button hangs past the right edge of its row', () => {
    render(
      <AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />,
    )
    const names = screen.getAllByTestId('analysis-new-options-focus')
    expect(names.length, 'PRECONDITION: the fixture renders option rows').toBeGreaterThan(1)
    for (const n of names) {
      const c = classes(n)
      expect(c, 'PRECONDITION: the button grows to fill its row').toContain('flex-1')
      expect(c.filter((k) => /^-m[xr]-/.test(k)), 'a right-hand negative margin makes the block scroll').toEqual([])
    }
  })
})
