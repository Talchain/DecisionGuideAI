/**
 * Copy hygiene — UI-authored copy only.
 *
 * Scans the panel's own copy (COACHING_COPY) for the forbidden glossary terms,
 * all-caps, and em dashes. It deliberately does NOT scan model-supplied strings:
 * those are data the UI renders verbatim (proven by the render check below and
 * the safety suite). This is the boundary — glossary correction of model output
 * is a CEE/mapper concern, never the renderer's (F.6 / UX amendment 3).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import { COACHING_COPY } from '../constants'
import { forbiddenTermInLabel } from '../__fixtures__/coaching.fixtures'

const FORBIDDEN = ['node', 'edge', 'graph', 'coefficient', 'weight', 'evpi', 'winner', 'recommended']

// All user-facing UI-authored strings, including the dynamic reveal labels.
const UI_COPY: string[] = [
  COACHING_COPY.panelAria,
  COACHING_COPY.emptyState,
  COACHING_COPY.showFewer,
  COACHING_COPY.askOlumi,
  COACHING_COPY.itemFallback,
  COACHING_COPY.staleBanner,
  COACHING_COPY.showMore(2),
  COACHING_COPY.showAll(5),
]

describe('CoachingPanel copy hygiene (UI copy only)', () => {
  it.each(FORBIDDEN)('contains no forbidden term: %s', (term) => {
    const re = new RegExp(`\\b${term}\\b`, 'i')
    for (const copy of UI_COPY) {
      expect(copy, `"${copy}" should not contain "${term}"`).not.toMatch(re)
    }
  })

  it('uses no all-caps words and no em dashes (sentence case, British English)', () => {
    for (const copy of UI_COPY) {
      expect(copy).not.toMatch(/\b[A-Z]{2,}\b/) // no SHOUTED words
      expect(copy).not.toContain('—') // no em dash
    }
  })

  it('renders model data containing forbidden terms verbatim (hygiene scopes to UI copy only)', () => {
    render(<CoachingPanel coaching={forbiddenTermInLabel} />)
    fireEvent.click(screen.getByRole('button', { name: /large coefficient weight/i }))
    expect(screen.getByText('the graph node')).toBeInTheDocument()
  })
})
