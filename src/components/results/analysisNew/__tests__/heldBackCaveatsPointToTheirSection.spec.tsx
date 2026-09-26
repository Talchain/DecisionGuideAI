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
 *
 * ⭐⭐ V2 DESIGN PASS (26 Sep 2026): NOTHING IS HELD BACK ON THIS TAB ANY MORE,
 * SO THERE IS NO POINTER TO BE WRONG. About › "Sources and limits" now lists
 * every inference warning as one bullet each — the strip's resting entry AND
 * the entries it would hold back (the builder's statement rows, its exact
 * complement) — in ONE list, as the prototype's `sourcesHTML()` does. The
 * property this file guards ("a reader told where the rest are finds them
 * there") is now held in its strongest form: the rest are not elsewhere at all.
 * Pinned both ways: no pointer on the tab, both entries in the one section —
 * and the CONTRAST that the shared strip, mounted alone over the same warnings,
 * still holds one back and says so (so this fixture can discriminate).
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
import { ABOUT_COPY } from '../sections/AboutThisAnalysis'
import { InferenceWarningStrip } from '../../InferenceWarningStrip'
import { heldBackStripCount } from '../../utils/humaniseInferenceWarning'

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
    // V2: About's own disclosures ("Limitations", "Run record") are titled
    // sub-sections too — `<div data-testid="…-detail-<key>">` headed by its
    // toggle. The strip now lives inside About, so its pointer names one.
    const id = node.getAttribute('data-testid') ?? ''
    if (/-detail-[a-z]+$/.test(id)) {
      const text = node.querySelector(`[data-testid="${id}-toggle"]`)?.textContent?.trim()
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
  // V2 (24 Sep 2026): the strip itself now lives in About › Limitations, so that
  // detail is opened too. V2 design pass (26 Sep 2026): every entry is a bullet
  // there; "Run record" is opened too so a row left behind in it would be seen.
  for (const id of [
    'analysis-new-about-toggle',
    'analysis-new-about-detail-limitations-toggle',
    'analysis-new-about-detail-record-toggle',
  ]) {
    const t = screen.queryByTestId(id)
    if (t && t.getAttribute('aria-expanded') === 'false') fireEvent.click(t)
  }
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the held-back caveat pointer names the section that lists them', () => {
  const CODES = ['CONSTRAINT_TARGET_UNRELIABLE', 'GOAL_ANCESTOR_DATA_GAP']

  it('PRECONDITION: the strip would hold one entry back, and every entry renders on the tab', () => {
    expect(heldBackStripCount(withTwoStripWarnings().confidence.inferenceWarnings)).toBe(1)
    render(
      <AnalysisNewTabBody
        resultsSectionData={withTwoStripWarnings()}
        isPreRun={false} isRunning={false} isStale={false} responseHash="hb1"
      />,
    )
    openTheHeldBackRows()
    const rendered = Array.from(document.querySelectorAll('[data-gap-code]')).map((el) => el.getAttribute('data-gap-code'))
    expect(rendered, 'each entry rendered once, none silently dropped').toEqual(CODES)
  })

  it('V2: no entry is held back — no pointer, and every entry sits in About › Sources and limits', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withTwoStripWarnings()}
        isPreRun={false} isRunning={false} isStale={false} responseHash="hb2"
      />,
    )
    openTheHeldBackRows()
    expect(
      screen.queryByTestId('inference-warning-strip-held-back'),
      'nothing is held back on this tab, so nothing points elsewhere',
    ).toBeNull()
    for (const code of CODES) {
      const row = document.querySelector(`[data-gap-code="${code}"]`)
      expect(row, code).not.toBeNull()
      const titles = enclosingSectionTitles(row!)
      expect(titles, `${code} sits under "Sources and limits" inside About`).toEqual(
        expect.arrayContaining([ABOUT_COPY.details.limitations, ABOUT_COPY.title]),
      )
    }
  })

  it('CONTRAST: the shared strip, mounted alone over the same warnings, still holds one back and says where', () => {
    render(
      <InferenceWarningStrip
        warnings={withTwoStripWarnings().confidence.inferenceWarnings}
        heldBackListedUnder="Somewhere"
      />,
    )
    expect(screen.getByTestId('inference-warning-strip-held-back')).toHaveTextContent('Somewhere')
  })
})
