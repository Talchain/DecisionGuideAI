/**
 * V7EvidenceDisclosure — the fourth view, "Resolve next" (V7-C slice 1,
 * ROADMAP 2.141). The render half of the design's §2 rendering-rules table.
 *
 * NON-DEGENERATE FIXTURE (ROADMAP 2.141 probe limit i). The live 30 Jul probe's
 * rank-order pin was VACUOUS because the run returned two zero-EVPPI factors, so
 * any order passed. The fixture therefore carries FOUR resolved rows with three
 * DISTINCT producer positions, a TIE PAIR at ranks 2-3, and TWO below-resolution
 * rows. One pin feeds a deliberately MIS-SORTED wire so accidental iteration
 * order cannot pass.
 *
 * The fixture, the row builder and the open-and-switch helper live in
 * `src/test/helpers/resolveNextView.tsx`, SHARED with
 * `results/__tests__/evpiSurfacesRemoved.resolveNext.honesty.spec.tsx`. Both
 * suites arrived in the same PR with private copies that had already diverged
 * (two `row()` signatures, two fixtures with different labels), so the two were
 * asserting against subtly different surfaces while reading as if they shared
 * one.
 *
 * CLAIM TYPE: rendered text / DOM presence within jsdom (trap 3). Nothing here
 * is a visibility or layout claim — the live check owns those.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../V7EvidenceDisclosure'
import { V7_LENS_COPY } from '../v7LensCopy'
import { v7EvidenceModel as model } from '@/__fixtures__/v7EvidenceModel'
import {
  voiRow as row,
  voiRankingFixture as ranking,
  openResolveNext,
} from '@/test/helpers/resolveNextView'

const E = V7_LENS_COPY.evidence

describe('V7EvidenceDisclosure — Resolve next: the ranking', () => {
  it('exposes a fourth view chip beside the existing three', () => {
    render(<V7EvidenceDisclosure evidence={model({ resolveNext: ranking() })} />)
    fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
    for (const key of ['drivers', 'flipRisks', 'tradeOffs', 'resolveNext']) {
      expect(screen.getByTestId(`v7-evidence-tab-${key}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('v7-evidence-tab-resolveNext')).toHaveTextContent('Resolve next')
  })

  it('renders on a VOI-only run (a ranking alone is enough to disclose)', () => {
    // The whole-section "nothing to disclose" guard must count the new view,
    // or a run whose only evidence is the ranking renders nothing at all.
    const { container } = render(<V7EvidenceDisclosure evidence={model({ resolveNext: ranking() })} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the resolved rows in PRODUCER ORDER, top 3 first', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    expect(screen.getByTestId('v7-evidence-resolve-next')).toBeInTheDocument()
    expect(screen.getAllByTestId('v7-resolve-next-row').map(n => n.textContent)).toEqual([
      expect.stringContaining('Market receptivity'),
      expect.stringContaining('Competitor response'),
      expect.stringContaining('Competitor response (Europe)'),
    ])
    // Rank 4 is clamped until expanded — the disclosure's shared row clamp,
    // VISIBLE_EVIDENCE_ROWS = 3 (the SAME constant Drivers uses, which is why
    // "mirrors Drivers'" is no longer a claim anyone has to keep true).
    expect(screen.queryByText('Regulatory timeline')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('v7-resolve-next-toggle'))
    expect(screen.getByText('Regulatory timeline')).toBeInTheDocument()
  })

  it('the TIE pair keeps producer order — the view never re-ranks', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    const labels = screen.getAllByTestId('v7-resolve-next-row').map(n => n.textContent ?? '')
    expect(labels[1]).toContain('Competitor response')
    expect(labels[1]).not.toContain('Europe')
    expect(labels[2]).toContain('Competitor response (Europe)')
  })

  it('renders a deliberately MIS-SORTED wire verbatim', () => {
    openResolveNext(
      model({
        resolveNext: ranking({
          resolved: [row('n_comp', 'Competitor response'), row('n_market', 'Market receptivity')],
          belowResolution: [],
        }),
      }),
    )
    const labels = screen.getAllByTestId('v7-resolve-next-row').map(n => n.textContent ?? '')
    expect(labels[0]).toContain('Competitor response')
    expect(labels[1]).toContain('Market receptivity')
  })

  it('rank 1 carries the headline annotation; ranks 2+ carry "then"', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    const lead = screen.getAllByTestId('v7-resolve-next-lead')
    expect(lead).toHaveLength(1)
    expect(lead[0]).toHaveTextContent(E.resolveNextLead)
    expect(screen.getAllByTestId('v7-resolve-next-then')).toHaveLength(2)
    // The headline annotation belongs to the FIRST row, not a floating line.
    expect(screen.getAllByTestId('v7-resolve-next-row')[0]).toContainElement(lead[0])
  })

  it('renders the basis-and-restraint note verbatim', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    expect(screen.getByText(E.resolveNextNote)).toBeInTheDocument()
  })

  it('is an ordered list, so the ranking is structural rather than narrated', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    expect(screen.getByTestId('v7-evidence-resolve-next').querySelector('ol')).not.toBeNull()
  })

  it('focuses the canvas node on row click, using the producer factor id', () => {
    const onFocusNode = vi.fn()
    openResolveNext(model({ resolveNext: ranking() }), onFocusNode)
    fireEvent.click(screen.getAllByTestId('v7-resolve-next-row')[0].querySelector('button')!)
    expect(onFocusNode).toHaveBeenCalledWith('n_market')
  })

  it('an unfocusable row renders as text, not a button', () => {
    openResolveNext(
      model({
        resolveNext: ranking({
          resolved: [row('n_market', 'Market receptivity', false)],
          belowResolution: [],
        }),
      }),
      vi.fn(),
    )
    expect(screen.getAllByTestId('v7-resolve-next-row')[0].querySelector('button')).toBeNull()
    expect(screen.getByText('Market receptivity')).toBeInTheDocument()
  })
})

/**
 * AMENDMENTS A1 + B1 at the RENDER level (adversarial review of PR #531).
 *
 * The reader is the authority on both verdicts and is pinned in
 * `voi/__tests__/voiRanking.spec.ts`. These two prove the consequence a USER
 * would have seen: the sentence that would have been attached to the wrong
 * factor, and the label that would have appeared at two ranks.
 */
describe('V7EvidenceDisclosure — Resolve next: the amended verdicts', () => {
  it('A1: the gate renders, so no factor wears "Most worth resolving next"', () => {
    // The reader returns null for a dropped rank-1; what matters here is that
    // the view then makes NO rank claim at all.
    openResolveNext(
      model({
        resolveNext: null,
        drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false }],
      }),
    )
    expect(screen.getByTestId('v7-evidence-resolve-next-gate')).toBeInTheDocument()
    expect(screen.queryByTestId('v7-resolve-next-lead')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v7-resolve-next-then')).not.toBeInTheDocument()
    expect(screen.getByTestId('v7-evidence-resolve-next').textContent).toBe(E.resolveNextGate)
  })

  it('B1: a deduped ranking shows the factor at exactly one rank', () => {
    // The React key was `${factorId}-${i}`, which quietly accommodated a
    // duplicated id. Post-dedup the model cannot carry one — this asserts the
    // rendered consequence, so a regression upstream is visible here too.
    openResolveNext(
      model({
        resolveNext: ranking({
          resolved: [row('n_market', 'Market receptivity'), row('n_comp', 'Competitor response')],
          belowResolution: [],
          someFactorsUnassessed: true,
        }),
      }),
    )
    expect(screen.getAllByText('Market receptivity')).toHaveLength(1)
    expect(screen.getAllByTestId('v7-resolve-next-lead')).toHaveLength(1)
    expect(screen.getByTestId('v7-resolve-next-partial')).toHaveTextContent(E.resolveNextPartial)
  })
})

describe('V7EvidenceDisclosure — Resolve next: below-resolution demotion', () => {
  it('demotes below-resolution factors to their own line, never into the ranks', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    const demoted = screen.getByTestId('v7-resolve-next-below')
    expect(demoted).toHaveTextContent(E.resolveNextBelow('Hiring pace, Brand halo'))
    // …and they are NOT ranked rows.
    const rankedText = screen.getAllByTestId('v7-resolve-next-row').map(n => n.textContent ?? '').join(' ')
    expect(rankedText).not.toContain('Hiring pace')
    expect(rankedText).not.toContain('Brand halo')
  })

  it('omits the demotion line entirely when no factor is below resolution', () => {
    openResolveNext(model({ resolveNext: ranking({ belowResolution: [] }) }))
    expect(screen.queryByTestId('v7-resolve-next-below')).not.toBeInTheDocument()
  })

  it('renders the demotion line with NO ranked rows when every factor is below resolution', () => {
    openResolveNext(model({ resolveNext: ranking({ resolved: [] }) }))
    expect(screen.queryAllByTestId('v7-resolve-next-row')).toHaveLength(0)
    expect(screen.getByTestId('v7-resolve-next-below')).toBeInTheDocument()
    // No headline claim can be made without a resolved rank 1.
    expect(screen.queryByTestId('v7-resolve-next-lead')).not.toBeInTheDocument()
    // And the basis note stays: it describes the basis, not a leader.
    expect(screen.getByText(E.resolveNextNote)).toBeInTheDocument()
  })

  it('never says "zero value" or "not worth resolving" about a demoted factor', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    const text = screen.getByTestId('v7-evidence-resolve-next').textContent ?? ''
    expect(text).not.toMatch(/zero value/i)
    expect(text).not.toMatch(/not worth resolving/i)
    expect(text).not.toMatch(/no value/i)
    // POSITIVE CONTROL for those three matchers (trap 13).
    expect('zero value').toMatch(/zero value/i)
    expect('not worth resolving').toMatch(/not worth resolving/i)
    expect('no value').toMatch(/no value/i)
  })
})

describe('V7EvidenceDisclosure — Resolve next: the honest gate', () => {
  it('renders the gate, and no rows, when the ranking is null', () => {
    openResolveNext(model({ resolveNext: null, drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false }] }))
    expect(screen.getByTestId('v7-evidence-resolve-next-gate')).toHaveTextContent(E.resolveNextGate)
    expect(screen.queryAllByTestId('v7-resolve-next-row')).toHaveLength(0)
    expect(screen.queryByTestId('v7-resolve-next-below')).not.toBeInTheDocument()
    // Never an empty list, and never the basis note over nothing.
    expect(screen.queryByText(E.resolveNextNote)).not.toBeInTheDocument()
  })

  it('the gate never names a factor or fabricates a rank', () => {
    openResolveNext(model({ resolveNext: null, drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false }] }))
    const text = screen.getByTestId('v7-evidence-resolve-next').textContent ?? ''
    expect(text).toBe(E.resolveNextGate)
  })
})

describe('V7EvidenceDisclosure — Resolve next: the PARTIAL disclosure', () => {
  it('renders the muted note when some factors could not be assessed', () => {
    openResolveNext(model({ resolveNext: ranking({ someFactorsUnassessed: true }) }))
    expect(screen.getByTestId('v7-resolve-next-partial')).toHaveTextContent(E.resolveNextPartial)
  })

  it('omits the note when every factor was assessed', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    expect(screen.queryByTestId('v7-resolve-next-partial')).not.toBeInTheDocument()
  })

  it('never names which factors failed', () => {
    openResolveNext(model({ resolveNext: ranking({ someFactorsUnassessed: true }) }))
    const note = screen.getByTestId('v7-resolve-next-partial').textContent ?? ''
    expect(note).not.toMatch(/n_/)
    expect(note).toBe(E.resolveNextPartial)
  })
})

describe('V7EvidenceDisclosure — Resolve next: no numbers, no magnitudes', () => {
  /** Any "<n>pp" token — the shape the refuted EVPI claim wore. */
  const PP_TOKEN = /\d+(\.\d+)?\s*pp\b/i
  /** Any digit at all. */
  const ANY_DIGIT = /\d/
  /** Anything that reads as a magnitude. */
  const DECIMAL = /\d+\.\d/

  /**
   * The view's CLAIM text: everything it says about the ranking, with the
   * "Show N more" expansion affordance removed.
   *
   * The carve-out is named rather than assumed. `Show N more` is the Drivers
   * row-clamp counter reused verbatim — a count of HIDDEN ROWS, not a value of
   * information — and it is the ONLY digit-bearing string in the view. It is
   * carved out here and then pinned exactly, below, so the carve-out cannot
   * become the hole through which a magnitude arrives.
   */
  function claimText(): string {
    const view = screen.getByTestId('v7-evidence-resolve-next').cloneNode(true) as HTMLElement
    view.querySelector('[data-testid="v7-resolve-next-toggle"]')?.remove()
    return view.textContent ?? ''
  }

  /** Every attribute value in the subtree except `class` (Tailwind's own
   * `py-0.5` / `gap-2` utilities are not data and must not be scanned as if
   * they were — that would make the assertion pass or fail on styling). */
  function dataAttributeValues(): string {
    const view = screen.getByTestId('v7-evidence-resolve-next')
    const out: string[] = []
    view.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name !== 'class') out.push(`${attr.name}=${attr.value}`)
      }
    })
    return out.join(' ')
  }

  it('renders no percentage-point token and no digit in any claim it makes', () => {
    openResolveNext(model({ resolveNext: ranking({ someFactorsUnassessed: true }) }))
    const text = claimText()
    expect(text).not.toMatch(PP_TOKEN)
    expect(text).not.toMatch(ANY_DIGIT)
    // Sanity: the extraction really did capture the claims it is scanning.
    expect(text).toContain(E.resolveNextLead)
    expect(text).toContain('Market receptivity')
    expect(text).toContain(E.resolveNextPartial)
  })

  it('the carved-out affordance is EXACTLY the row-clamp counter, nothing more', () => {
    openResolveNext(model({ resolveNext: ranking({ someFactorsUnassessed: true }) }))
    // 4 resolved rows, 3 visible → the counter says "Show 1 more" and no more.
    expect(screen.getByTestId('v7-resolve-next-toggle')).toHaveTextContent(E.seeMore(1))
    expect(screen.getByTestId('v7-resolve-next-toggle').textContent).toBe(E.seeMore(1))
  })

  it('POSITIVE CONTROL: both detectors fire on a planted number', () => {
    // Trap 13 — the absence above is vacuous until the detectors are shown to
    // see a presence, in THIS harness, through THIS text extraction.
    openResolveNext(
      model({
        resolveNext: ranking({
          resolved: [row('n_market', 'Market receptivity worth 12.3pp if resolved')],
          belowResolution: [],
        }),
      }),
    )
    const planted = claimText()
    expect(planted).toMatch(PP_TOKEN)
    expect(planted).toMatch(ANY_DIGIT)
    expect(planted).toMatch(DECIMAL)
  })

  it('carries no magnitude in the DOM data attributes either', () => {
    openResolveNext(model({ resolveNext: ranking() }))
    const attrs = dataAttributeValues()
    expect(attrs).not.toContain('evppi')
    expect(attrs).not.toContain('noise_floor')
    expect(attrs).not.toMatch(DECIMAL)
    // POSITIVE CONTROL for the extractor: it DOES see the attributes it scans.
    expect(attrs).toContain('v7-resolve-next-row')
    expect(attrs).toContain('v7-resolve-next-lead')
  })
})
