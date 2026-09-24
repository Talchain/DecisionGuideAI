/**
 * THE STRIP'S "MORE ARE LISTED UNDER X" MUST NAME THE SECTION THAT LISTS THEM.
 *
 * The caveat strip shows ONE limitation at rest and discloses the rest with a
 * pointer — "One more limitation is listed under How this was worked out." On
 * the Reasoning tab that was false: the held-back entries render in
 * DeeperAnalysis's "Model gaps the analysis worked around" group, which mounts
 * inside "What moves the outcome" (`AnalysisNewTabBody.tsx`, the SectionShell
 * wrapping `<DeeperAnalysis>`). A reader who followed the pointer opened the
 * wrong section and found nothing. Banked as F5 in the panel evidence note
 * (`EVIDENCE-20260923.md`) and fixed here.
 *
 * ⭐ BOUND TO THE RENDER, NOT TO A STRING. The assertion walks UP from the
 * held-back row the tab actually rendered and collects the titles of every
 * section containing it; the pointer must name one of them. So if the row
 * moves again, this goes RED without anyone remembering to update a literal.
 *
 * ⭐ V2 (24 Sep 2026): IT MOVED AGAIN, AND THIS FILE IS WHY THE POINTER FOLLOWED.
 * `DeeperAnalysis` is no longer mounted; its groups render as the "Run record"
 * detail inside `AboutThisAnalysis` (collapsed, last on the tab), and the strip
 * now names `ABOUT_COPY.title`. Re-pointed: the opener walks About's own
 * toggles, and a section's title is read from its `-title` element (the
 * `SectionShell` convention) or, where a section has none, from the element its
 * `aria-labelledby` names — About's heading holds only its title.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroups } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { manyFragileEdges } from './analysisNewFixtures'

/** Two WARNING-severity entries: the strip shows one and holds the other back. */
function withTwoStripWarnings() {
  const data = manyFragileEdges()
  return {
    ...data,
    confidence: {
      ...data.confidence,
      inferenceWarnings: [
        {
          code: 'CONSTRAINT_TARGET_UNRELIABLE',
          affected_nodes: [],
          message: "The target for 'out_margin' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
          severity: 'warning',
        },
        {
          code: 'GOAL_ANCESTOR_DATA_GAP',
          affected_nodes: [],
          message: 'Some factors upstream of the goal have no observed value.',
          severity: 'warning',
        },
      ],
    },
  }
}

/** Titles of every SectionShell (`section[aria-labelledby]`) containing `el`. */
function enclosingSectionTitles(el: Element): string[] {
  const titles: string[] = []
  let node: Element | null = el.parentElement
  while (node) {
    if (node.tagName === 'SECTION') {
      // The TITLE element only — the heading also carries the subtitle and count.
      const testId = node.getAttribute('data-testid')
      const labelledBy = node.getAttribute('aria-labelledby')
      const title =
        (testId ? node.querySelector(`[data-testid="${testId}-title"]`) : null) ??
        // No `-title` element (AboutThisAnalysis): the section's accessible
        // name, i.e. the heading `aria-labelledby` points at.
        (labelledBy ? document.getElementById(labelledBy) : null)
      const text = title?.textContent?.trim()
      if (text) titles.push(text)
    }
    node = node.parentElement
  }
  return titles
}

/** Open every collapse between the tab and the held-back rows: About this
 *  analysis, then its "Run record" detail (V2 — formerly the drivers group, then
 *  DeeperAnalysis's own toggle). Clicked only when collapsed, so it cannot close. */
function openTheHeldBackRows(): void {
  openGroups()
  for (const id of ['analysis-new-about-toggle', 'analysis-new-about-detail-record-toggle']) {
    const t = screen.queryByTestId(id)
    if (t && t.getAttribute('aria-expanded') === 'false') fireEvent.click(t)
  }
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the held-back caveat pointer names the section that lists them', () => {
  it('PRECONDITION: one entry is held back, and it renders somewhere on the tab', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withTwoStripWarnings()}
        isPreRun={false} isRunning={false} isStale={false} responseHash="hb1"
      />,
    )
    openTheHeldBackRows()
    expect(screen.getByTestId('inference-warning-strip-held-back')).toBeInTheDocument()
    // The held-back entry is the one the strip did NOT show.
    const rows = document.querySelectorAll('[data-gap-code]')
    expect(rows.length, 'the held-back entry must be rendered, not silently dropped').toBeGreaterThan(0)
  })

  it('RED-FIRST — the pointer names a section that actually contains the held-back row', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withTwoStripWarnings()}
        isPreRun={false} isRunning={false} isStale={false} responseHash="hb2"
      />,
    )
    openTheHeldBackRows()
    const pointer = screen.getByTestId('inference-warning-strip-held-back').textContent ?? ''
    const row = document.querySelector('[data-gap-code]')
    expect(row).not.toBeNull()
    const titles = enclosingSectionTitles(row!)
    expect(titles.length, 'PRECONDITION: the held-back row sits inside a titled section').toBeGreaterThan(0)
    expect(
      titles.some((t) => pointer.includes(t)),
      `pointer "${pointer}" must name one of the sections containing the row: ${JSON.stringify(titles)}`,
    ).toBe(true)
  })
})
