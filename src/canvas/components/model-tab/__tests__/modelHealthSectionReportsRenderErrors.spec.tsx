/**
 * THE MODEL CARD REPORTS ITS OWN RENDER ERRORS — pinned after a live repoint.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG, MEASURED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This tree carries TWO components called `SectionErrorBoundary`:
 *
 *   · `canvas/components/GraphTextView.tsx`      — `componentDidCatch` does
 *     `console.error` and nothing else. Measured at `18d681c2`:
 *     `captureError` 0 occurrences, `componentStack` 0.
 *   · `canvas/components/SectionErrorBoundary.tsx` — reports to monitoring and
 *     retains the component stack. Measured at the same SHA:
 *     `captureError` 2, `componentStack` 11.
 *
 * `ModelHealthSection` is the Model card. It IS mounted — `ModelTabBody` renders
 * it outside the `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate, which is why it
 * survived that gate's deletion on 2026-09-11 — and it was importing the FIRST
 * twin. So a render error in a LIVE user-facing surface produced no monitoring
 * event and no component stack: it was reported to nothing.
 *
 * The four other live consumers of the reporting twin (`OutputsDock`,
 * `ResultsBody`, `PreAnalysisPanel`, `WhatOlumiAddedSection`) already had it.
 * This was the odd one out, and it was odd because it inherited the import from
 * the five v1 siblings that were deleted around it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE BEHAVIOURAL CASE IS THE LOAD-BEARING ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A source-reading guard ("the import string says `../SectionErrorBoundary`")
 * would pass against a twin that had been edited to stop reporting. The case
 * below drives a REAL render error through the REAL boundary and asserts the
 * REAL monitoring call — so it REDs both if the import is pointed back at the
 * console-only twin AND if the surviving twin's reporting call is removed.
 *
 * ⚠ THE BOUNDARY IS NOT MOCKED IN THIS FILE, DELIBERATELY. Every sibling spec
 * stubs `SectionErrorBoundary` to a pass-through, which is right for testing the
 * card's content and would make THIS assertion vacuous — a guard agreeing with
 * itself. Only `Accordion` and `lib/monitoring` are mocked here.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

const captureErrorMock = vi.fn()
vi.mock('../../../../lib/monitoring', () => ({
  captureError: (...args: unknown[]) => captureErrorMock(...args),
}))

/**
 * The throw switch. `Accordion` is rendered by `ModelHealthSectionInner`, i.e.
 * INSIDE the boundary — so throwing here is a render error the boundary must
 * catch, not a module-load error that would fail the whole file.
 */
let accordionShouldThrow = false
vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, title, testId }: { children: React.ReactNode; title: string; testId?: string }) => {
    if (accordionShouldThrow) throw new Error('deliberate render failure inside the Model card')
    return (
      <div data-testid={testId}>
        <span>{title}</span>
        {children}
      </div>
    )
  },
}))

import { ModelHealthSection } from '../ModelHealthSection'

const QUALITY = { overall: 7.2, structure: 8, causality: 6.5, coverage: 7, safety: 7.5 }

// React logs every caught boundary error. Silence it so a deliberate throw does
// not look like a suite failure — but restore it, so a LATER spec still sees its
// own console errors.
const realConsoleError = console.error
beforeEach(() => {
  captureErrorMock.mockClear()
  accordionShouldThrow = false
  console.error = vi.fn()
})
afterAll(() => {
  console.error = realConsoleError
})

describe('the Model card reports render errors to monitoring', () => {
  it('POSITIVE CONTROL: the card renders, and a healthy render reports NOTHING', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    // The instrument can see the component at all — without this, the absence
    // assertion below could pass against a card that never mounted.
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
    expect(captureErrorMock).not.toHaveBeenCalled()
  })

  it('CONTROL: the throw switch actually produces a caught render error', () => {
    // Pins this file's own precondition. If the switch stopped working, the
    // reporting assertion below would pass by never triggering an error at all.
    accordionShouldThrow = true
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    // The boundary caught it: the card's content is gone and the fallback is up.
    expect(screen.queryByTestId('model-health-section')).not.toBeInTheDocument()
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument()
  })

  it('⭐ THE PIN: a render error inside the Model card reaches captureError', () => {
    accordionShouldThrow = true
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    expect(
      captureErrorMock,
      '\nThe Model card is mounted and its render error reported to NOTHING.\n' +
        'Either the import was pointed back at the console-only SectionErrorBoundary\n' +
        "in GraphTextView.tsx, or the surviving twin's captureError call was removed.\n",
    ).toHaveBeenCalledTimes(1)

    const [error, context] = captureErrorMock.mock.calls[0] as [Error, Record<string, unknown>]
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('deliberate render failure inside the Model card')

    // Bind by IDENTITY, not by "some context was passed": the label must name
    // THIS section, so a report from any other boundary cannot satisfy it.
    expect(context.label).toBe('SectionErrorBoundary:model-health')
  })

  it('⭐ THE PIN, SECOND HALF: the report carries a component stack', () => {
    // This is the half the console-only twin could never satisfy even if someone
    // added a bare captureError call to it — it never captures `info`.
    accordionShouldThrow = true
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    const [, context] = captureErrorMock.mock.calls[0] as [Error, Record<string, unknown>]
    expect(typeof context.componentStack, 'no component stack — the report cannot be triaged').toBe('string')
    expect((context.componentStack as string).length).toBeGreaterThan(0)
  })
})
