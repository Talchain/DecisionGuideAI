/**
 * ⭐ THE USER READS WHAT LEAVES OLUMI BEFORE PRESSING SEARCH (CEE #2042, native public research R1).
 *
 * CEE offers ONE control per approved query: label "Search the web", `message` = the exact query, and
 * `detail` = "Only these words are sent to a public web search: “<query>”. Nothing from your model or this
 * conversation is sent." The click IS the disclosure decision (`approvedQueryOf`), so the query must be
 * READABLE before the click. The apply-chip rule (`SuggestedChips.applyDetail.spec.tsx`) puts `detail` in
 * the accessible name + `title` only; for this chip that meant the query existed only in a hover tooltip,
 * and the transcript echo is the label — the user learnt what was sent only from the reply.
 *
 * Bound by chip IDENTITY (the `agent-public-research:` id prefix), never by label text or `detail` shape.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

const QUERY = 'typical monthly customer churn for SMB B2B SaaS'
const RESEARCH_ID = 'agent-public-research:9f2c41d0a7b3e815'
const RESEARCH_DETAIL = `Only these words are sent to a public web search: “${QUERY}”. Nothing from your model or this conversation is sent.`

const researchChip: ActionChip = {
  id: RESEARCH_ID,
  label: 'Search the web',
  intent: 'primary',
  message: `Search the web for: “${QUERY}”`,
  detail: RESEARCH_DETAIL,
}

// Same `detail` shape on a chip that is NOT a research control: the apply-chip rule must still hold.
const applyChip: ActionChip = {
  id: 'rrp_7576c3fbaf58',
  label: 'Apply 3 safe model fixes',
  intent: 'primary',
  message: 'Yes, apply all 3 safe model fixes.',
  detail: 'Canonicalise the existing effect values for "Do nothing" without changing them.',
}

function renderChips(chips: ActionChip[], extra: Partial<Parameters<typeof SuggestedChips>[0]> = {}) {
  return render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} {...extra} />)
}

describe('SuggestedChips — a research control shows the exact query it sends', () => {
  it('renders the disclosure, with the exact query, as visible text beside the chip', () => {
    renderChips([researchChip])
    const disclosure = screen.getByTestId(`suggested-chip-disclosure-${RESEARCH_ID}`)
    expect(disclosure.textContent).toBe(RESEARCH_DETAIL)
    expect(disclosure.textContent).toContain(`“${QUERY}”`)
  })

  it('the chip is described by that disclosure, and its visible text stays the label', () => {
    renderChips([researchChip])
    const button = screen.getByTestId(`suggested-chip-${RESEARCH_ID}`)
    const disclosure = screen.getByTestId(`suggested-chip-disclosure-${RESEARCH_ID}`)
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain(disclosure.id)
    expect(button.textContent).toBe('Search the web')
  })

  it('CONTROL: a non-research chip with a detail keeps the tooltip rule — no visible disclosure', () => {
    renderChips([applyChip, researchChip])
    expect(screen.queryByTestId(`suggested-chip-disclosure-${applyChip.id}`)).toBeNull()
    expect(screen.getByTestId(`suggested-chip-${applyChip.id}`).getAttribute('title')).toBe(applyChip.detail)
    expect(screen.getAllByTestId(/^suggested-chip-disclosure-/)).toHaveLength(1)
  })

  it('a research chip with no detail shows no empty disclosure', () => {
    renderChips([{ ...researchChip, detail: undefined }])
    expect(screen.queryByTestId(`suggested-chip-disclosure-${RESEARCH_ID}`)).toBeNull()
  })
})
