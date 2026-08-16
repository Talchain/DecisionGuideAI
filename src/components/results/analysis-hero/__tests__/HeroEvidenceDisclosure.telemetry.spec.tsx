/**
 * `evidence_view_opened` — the emitter, re-homed onto this host.
 *
 * ⭐ WHY THIS SUITE EXISTS. `measurementEvents.ts` calls this event "the
 * highest-value single site in this taxonomy": it captures what the product
 * TOLD the user at the moment it told them, and for the resolve-next ranking
 * that is the only moment at which it is the truth (the ranking is recomputed
 * every run, so reading it back afterwards answers a different question). Its
 * ONLY emitter in the repo was `V7EvidenceDisclosure`; the V7 retirement left
 * the event with a declared schema and zero emitters. This suite pins the
 * emitter on the surviving host.
 *
 * ⚠ THE PAYLOAD'S PII DISCIPLINE IS NOT PINNED HERE — it is pinned by a
 * RENDER-DRIVEN case in the sibling `HeroEvidenceDisclosure.pii.spec.tsx`, with
 * a poisoned model and a presence precondition. This suite pins WHEN the event
 * fires and WHAT it says about the view; that one pins what it must never
 * carry.
 *
 * (That case used to live in `telemetry/__tests__/measurementEvents.pii.spec.tsx`
 * — "with the other PII claims, where the leak detector and its planted control
 * live". It moved next door because rendering this component from outside the
 * module trips `__tests__/inertness.spec.ts`, the live mount guard, which was
 * NOT widened. The leak detector and the planted control are now shared from
 * `telemetry/__tests__/helpers/piiCanary.ts`, so both files still run one
 * instrument.)
 *
 * The spy is on `lib/posthog.trackEvent`, i.e. the real transport, so these
 * assertions go through `trackMeasurement`'s schema filter rather than around
 * it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Clicks go through `helpers/heroEvidenceView`, which owns the `fireEvent`
// rationale (a raw `node.click()` escapes act() and reads a collapsed section).
import { render, cleanup } from '@testing-library/react'

const trackEventSpy = vi.fn()
vi.mock('../../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
}))

import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import { heroEvidenceModel as model, heroDriverRow } from '../__fixtures__/heroEvidenceModel'
import { openDisclosureHeader, switchEvidenceView } from './helpers/heroEvidenceView'
import { useCanvasStore } from '@/canvas/store'

const DRIVER = heroDriverRow('undetermined', { rank: 1, label: 'Price', targetId: null })
const FLIP = { text: 'If Price falls below 30, the other option leads.', targetId: null, switchMeta: null, magnitude: null }
const RANKING = {
  resolved: [{ factorId: 'fac_market', label: 'Market receptivity', canFocus: true }],
  belowResolution: [{ factorId: 'fac_brand', label: 'Brand halo', canFocus: false }],
  someFactorsUnassessed: true,
}

const openings = () => trackEventSpy.mock.calls.filter((c) => c[0] === 'evidence_view_opened')

beforeEach(() => {
  trackEventSpy.mockClear()
  useCanvasStore.setState({ currentScenarioId: 'sc-7' } as never)
})

afterEach(() => {
  cleanup()
})

describe('evidence_view_opened fires from the hero evidence disclosure', () => {
  it('§1 does NOT fire on render — only on OPENING', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER] })} />)
    expect(
      openings().length,
      'a collapsed disclosure told the user nothing, so there is nothing to record',
    ).toBe(0)

    openDisclosureHeader()
    expect(openings().length).toBe(1)
    expect(openings()[0][1]).toMatchObject({ view: 'drivers', scenario_id: 'sc-7', gated: false })
  })

  it('§2 fires again on each VIEW CHANGE, naming the view actually shown', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER], flipRisks: [FLIP] })} />)
    openDisclosureHeader()
    switchEvidenceView('flipRisks')

    expect(openings().map((c) => (c[1] as { view: string }).view)).toEqual([
      'drivers',
      'flipRisks',
    ])
  })

  it('§3 closing and reopening on the same view re-emits (a new opening IS one)', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER] })} />)
    openDisclosureHeader()
    openDisclosureHeader() // closed
    openDisclosureHeader() // reopened
    expect(openings().length).toBe(2)
  })

  it('§4 a re-render on the same open view does NOT re-emit', () => {
    // `evidence` is deliberately not an effect dep: a new model object on the
    // same open view is a re-render, not a new opening.
    const { rerender } = render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER] })} />)
    openDisclosureHeader()
    expect(openings().length).toBe(1)
    rerender(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER] })} />)
    expect(openings().length).toBe(1)
  })

  it('§5 the resolve-next opening carries the rank-1 ID and the two counts', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER], resolveNext: RANKING })} />)
    openDisclosureHeader()
    switchEvidenceView('resolveNext')

    const resolveNext = openings().find((c) => (c[1] as { view: string }).view === 'resolveNext')
    expect(resolveNext, 'no resolveNext opening recorded').toBeTruthy()
    expect(resolveNext![1]).toMatchObject({
      view: 'resolveNext',
      gated: false,
      rank1_factor_id: 'fac_market',
      ranked_count: 1,
      below_resolution_count: 1,
      some_factors_unassessed: true,
    })
  })

  it('§6 the resolve-next-only fields are ABSENT on a non-resolve-next opening', () => {
    // Discriminating twin for §5: the same model, a different view. Without
    // this, an emitter that spread the ranking fields unconditionally would
    // still pass §5.
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER], resolveNext: RANKING })} />)
    openDisclosureHeader()

    const drivers = openings().find((c) => (c[1] as { view: string }).view === 'drivers')
    const keys = Object.keys(drivers![1] as Record<string, unknown>)
    expect(keys).not.toContain('rank1_factor_id')
    expect(keys).not.toContain('ranked_count')
    expect(keys).not.toContain('below_resolution_count')
    expect(keys).not.toContain('some_factors_unassessed')
  })

  it('§7 scenario_id is null when no scenario is loaded (an id is never invented)', () => {
    useCanvasStore.setState({ currentScenarioId: null } as never)
    render(<HeroEvidenceDisclosure evidence={model({ drivers: [DRIVER] })} />)
    openDisclosureHeader()
    expect((openings()[0][1] as { scenario_id: unknown }).scenario_id).toBeNull()
  })

  it('§8 nothing to disclose emits nothing (the surface said nothing)', () => {
    render(<HeroEvidenceDisclosure evidence={model({})} />)
    expect(openings().length).toBe(0)
  })
})
