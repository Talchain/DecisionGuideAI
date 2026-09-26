/**
 * ⭐⭐ A HOLD SAYS ITS OPERATIVE CAUSE — never "re-draft" while the user's own
 * edit is what analysis is waiting on.
 *
 * ## The finding (purpose audit, 23 Sep 2026 — #1892, #1893, delete-unconfirmed-hold,
 *    cross-cutting item 1)
 *
 * `analysisHeldOn` holds analysis on a saved example until CEE acknowledges the
 * graph. After #1892 an unconfirmed Canvas edit ALSO keeps the graph
 * unacknowledged — registration waits for it (`editDeliveryHold`) — so the hold
 * very often exists because of the USER'S OWN change. But the only on-screen
 * reason was "Analysis is held on a saved example. Re-draft it live to run
 * one.": the wrong cause, and a remedy that REPLACES the model the user is
 * trying to settle (ROADMAP 2.1442 measured re-draft destroying user-set
 * estimates). `editDeliveryHold`'s cause was "log vocabulary only — never user
 * copy", so no surface could say what was really happening.
 *
 * ## What this pins
 *
 *  1. For EVERY `editDeliveryHold` cause, on every surface that prints the hold
 *     — the shared authority, the legacy footer gate, the run gate's reason (the
 *     V3 footer and the Model-tab reanalyse bar read it; the dock spec
 *     `OutputsDock.holdSaysItsCause.spec.tsx` mounts those), the run chip's
 *     title and the saved-example banner — the sentence names the operative
 *     cause, names the element (and the value) where the state holds them, and
 *     contains NO "re-draft".
 *  2. CONTROLS: no edit unresolved → the saved-example sentence is byte-identical
 *     to before (starter AND template); model acknowledged → no hold text at all,
 *     even with an edit in flight; off the canonical run path → none either.
 *  3. PARITY: every surface prints the SAME sentence, and it is the shared
 *     function's — including through the footer's CEE-text vet, which would
 *     otherwise rewrite a user's label ("Edge…") on some surfaces and not others.
 *  4. REACTIVITY: the wire mark and the pending-value register are module state,
 *     not store state — a surface that listened to the store alone would keep
 *     saying "still being saved" after the turn had settled unconfirmed.
 *  5. WIRING: both run-gate call sites feed the gate the shared hold reason.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/ConversationContext')>()
  return {
    ...actual,
    // The banner reads the shared composer buffer; its real shape is listed so
    // no field is `undefined` in the component (a factory replaces the module).
    useConversationContext: () => ({ sendMessage: vi.fn(), draft: '', setDraft: vi.fn() }),
  }
})

import * as held from '../analysisHeldOnInjectedModel'
import { ANALYSIS_HELD_NOTICE, analysisHeldNotice } from '../analysisHeldOnInjectedModel'
import { canRunAnalysis, getRunButtonTooltip } from '../canRunAnalysis'
import { vetBlockedReason } from '../vetBlockedReason'
import { applyAnalysisHold, type FooterGate } from '../../components/pre-analysis/footerGate'
import { NodeChip } from '../../nodes/shared/NodeChip'
import { StarterProvenanceBanner } from '../../components/StarterProvenanceBanner'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { beginModelEditDelivery } from '../../registration/editDeliveryHold'
import { markFactorEditInFlight } from '../../conversation/pendingFactorEdit'
import { SRC, blankComments, runGateCallSites } from './helpers/derivedCallSites'
import {
  CAUSE_MUST_NAME,
  FACTOR_ID,
  FACTOR_LABEL,
  HOLD_CAUSES,
  TEMPLATE_STAMP,
  USER_VALUE,
  acknowledgeCurrentGraph,
  arrangeHoldCause,
  resetEditHoldRegisters,
  seedHeldCanvas,
  type HoldCause,
} from '../../registration/__tests__/helpers/editHoldCauses'

const READY: FooterGate = { isReady: true, hasBlockers: false, blockerCount: 0, blockedReason: undefined }
const REDRAFT = /re-?draft/i

/** The deployed run-path posture (see `OutputsDock.blockedReasonWiring.spec.tsx`). */
function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

/**
 * The shared authority's sentence for the CURRENT store state. Read through the
 * module namespace so a missing export fails the case that needs it, not the
 * whole file.
 */
function sharedSentence(): string | null {
  const reason = held.heldReason(useCanvasStore.getState() as never)
  return reason === null ? null : reason.sentence
}

function renderRunChip() {
  return render(
    <ToastProvider>
      <NodeChip chipId="decision_run_analysis" actionType="run_analysis" label="Run analysis" message="Run the analysis now" />
    </ToastProvider>,
  )
}
const runChip = () => screen.getByRole('button', { name: 'Run analysis' })

/**
 * The banner line that carries the hold claim (the button beside it is separate).
 * contract v3.1 (DESIGN-GAP #3): the disclosure rests as one quiet line and this
 * sentence is in its detail, one click away — opened here, and asserted open.
 */
function bannerHoldLine(): HTMLElement {
  render(<StarterProvenanceBanner />)
  fireEvent.click(screen.getByTestId('starter-provenance-line'))
  expect(screen.getByTestId('starter-provenance-detail')).toBeInTheDocument()
  return screen.getByText(/Edit anything on the canvas\./)
}

/** The run gate's reason, fed exactly as both call sites feed it. */
function gateReason(): string | undefined {
  const gate = canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: useCanvasStore.getState().nodes.length,
    analysisHeldOn: held.heldReason(useCanvasStore.getState() as never),
  } as never)
  return getRunButtonTooltip(gate)
}

function expectNamesTheCause(text: string | null | undefined, cause: HoldCause) {
  expect(text, `no hold sentence for ${cause}`).toBeTruthy()
  const s = text as string
  expect(s, `${cause}: offers re-draft while a user edit is unresolved`).not.toMatch(REDRAFT)
  expect(s, `${cause}: still blames a saved example`).not.toContain('saved example')
  for (const needle of CAUSE_MUST_NAME[cause]) {
    if (typeof needle === 'string') expect(s, `${cause}: does not name "${needle}"`).toContain(needle)
    else expect(s, `${cause}: does not say ${needle}`).toMatch(needle)
  }
}

beforeEach(() => {
  seedCanonicalRunPath()
  resetEditHoldRegisters()
  seedHeldCanvas()
})

afterEach(() => {
  cleanup()
  resetEditHoldRegisters()
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* jsdom quirk */ }
})

describe('PRECONDITIONS — the fixture is the state the finding describes', () => {
  it.each(HOLD_CAUSES)('%s: the model IS held and an edit IS unresolved', async (cause) => {
    arrangeHoldCause(cause)
    const { editDeliveryHold } = await import('../../registration/editDeliveryHold')
    const { analysisHeldOn } = await import('../analysisHeldOnInjectedModel')
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBe('starter')
    expect(editDeliveryHold(useCanvasStore.getState() as never)).not.toBeNull()
  })
})

describe('the shared authority names the operative cause', () => {
  it.each(HOLD_CAUSES)('%s', (cause) => {
    arrangeHoldCause(cause)
    expectNamesTheCause(sharedSentence(), cause)
  })

  it('never states a value the state does not hold — no model value is invented', () => {
    arrangeHoldCause('unconfirmed_value')
    const s = sharedSentence() as string
    // The canvas carried 0.55 before the edit; nothing on the client knows what
    // CEE now holds, so neither that number nor any other may be asserted.
    expect(s).not.toContain('0.55')
    expect(s.match(/\d+(\.\d+)?/g)).toEqual([String(USER_VALUE)])
  })
})

describe('every surface prints it — and none offers re-draft', () => {
  it.each(HOLD_CAUSES)('%s → legacy footer gate', (cause) => {
    arrangeHoldCause(cause)
    const gate = applyAnalysisHold(READY, analysisHeldNotice(useCanvasStore.getState() as never))
    expect(gate.hasBlockers && gate.blockerCount > 0, 'footer would still enable').toBe(true)
    expectNamesTheCause(gate.blockedReason, cause)
  })

  it.each(HOLD_CAUSES)('%s → run gate reason (V3 footer, reanalyse bar, composer, run toast)', (cause) => {
    arrangeHoldCause(cause)
    expectNamesTheCause(gateReason(), cause)
  })

  it.each(HOLD_CAUSES)('%s → run chip title', (cause) => {
    arrangeHoldCause(cause)
    renderRunChip()
    expectNamesTheCause(runChip().getAttribute('title'), cause)
  })

  it.each(HOLD_CAUSES)('%s → saved-example banner', (cause) => {
    arrangeHoldCause(cause)
    const line = bannerHoldLine()
    expectNamesTheCause(line.textContent, cause)
  })
})

describe('PARITY — one sentence, whichever surface prints it', () => {
  it.each(HOLD_CAUSES)('%s', (cause) => {
    arrangeHoldCause(cause)
    const shared = sharedSentence()
    expect(shared).toBeTruthy()

    const footer = applyAnalysisHold(READY, analysisHeldNotice(useCanvasStore.getState() as never)).blockedReason
    const gate = gateReason()
    // The V3 footer and the reanalyse bar render the gate's reason THROUGH the
    // CEE-text vet; a sentence the vet rewrites is a different sentence.
    const vetted = gate === undefined ? undefined : vetBlockedReason(gate)
    renderRunChip()
    const chip = runChip().getAttribute('title')
    cleanup()
    const banner = bannerHoldLine().textContent?.replace(/^Edit anything on the canvas\.\s*/, '')

    expect({ footer, gate, vetted, chip, banner }).toEqual({
      footer: shared,
      gate: shared,
      vetted: shared,
      chip: shared,
      banner: shared,
    })
  })
})

/**
 * The controls are split so the SURFACE half passes at the base as well as at
 * the head — that is what shows it is a control (behaviour unchanged) rather
 * than a second assertion of the fix. The shared-function half cannot run at
 * the base, where the function does not exist.
 */
describe('CONTROLS — nothing else moves', () => {
  it('no edit unresolved: the surfaces print the saved-example sentence, unchanged', () => {
    expect(analysisHeldNotice(useCanvasStore.getState() as never)).toBe(ANALYSIS_HELD_NOTICE.starter)
    expect(applyAnalysisHold(READY, analysisHeldNotice(useCanvasStore.getState() as never)).blockedReason)
      .toBe(ANALYSIS_HELD_NOTICE.starter)
    renderRunChip()
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
    cleanup()
    expect(bannerHoldLine()).toHaveTextContent(ANALYSIS_HELD_NOTICE.starter)
  })

  it('no edit unresolved: the shared function and the gate give the same saved-example sentence', () => {
    expect(sharedSentence()).toBe(ANALYSIS_HELD_NOTICE.starter)
    expect(gateReason()).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('no edit unresolved on a TEMPLATE: the template sentence is unchanged', () => {
    seedHeldCanvas({ stamp: TEMPLATE_STAMP })
    expect(analysisHeldNotice(useCanvasStore.getState() as never)).toBe(ANALYSIS_HELD_NOTICE.template)
    expect(sharedSentence()).toBe(ANALYSIS_HELD_NOTICE.template)
    expect(gateReason()).toBe(ANALYSIS_HELD_NOTICE.template)
  })

  it.each(HOLD_CAUSES)('model ACKNOWLEDGED + %s: no hold text on any surface', (cause) => {
    arrangeHoldCause(cause)
    acknowledgeCurrentGraph()
    expect(analysisHeldNotice(useCanvasStore.getState() as never)).toBeNull()
    expect(applyAnalysisHold(READY, analysisHeldNotice(useCanvasStore.getState() as never))).toEqual(READY)
    renderRunChip()
    expect(runChip()).not.toHaveAttribute('title')
    cleanup()
    expect(bannerHoldLine().textContent).toBe('Edit anything on the canvas.')
  })

  it.each(HOLD_CAUSES)('model ACKNOWLEDGED + %s: the shared function and the gate say nothing', (cause) => {
    arrangeHoldCause(cause)
    acknowledgeCurrentGraph()
    expect(held.heldReason(useCanvasStore.getState() as never)).toBeNull()
    expect(gateReason()).toBeUndefined()
  })

  it('OFF the canonical run path + an unresolved edit: no hold text', () => {
    try { localStorage.setItem('feature.v5CanonicalAnalysis', '0') } catch { /* jsdom quirk */ }
    arrangeHoldCause('unconfirmed_value')
    expect(held.heldReason(useCanvasStore.getState() as never)).toBeNull()
  })
})

describe('REACTIVITY — the module registers move the surfaces, not only the store', () => {
  it('the chip stops saying "being saved" once the turn settles unconfirmed, with no store write', () => {
    // An edit on the wire, whose value is also recorded as sent.
    seedHeldCanvas({ factorValue: USER_VALUE })
    const release = beginModelEditDelivery('factor_value_edit')
    markFactorEditInFlight(FACTOR_ID, USER_VALUE)
    renderRunChip()
    expect(runChip().getAttribute('title')).toMatch(/still being saved/i)

    // The untyped 500: the wire mark releases, the pending value stays. Neither
    // is a canvas-store write.
    act(() => release())
    const title = runChip().getAttribute('title') ?? ''
    expect(title).not.toMatch(/still being saved/i)
    expect(title).toContain(FACTOR_LABEL)
    expect(title).toMatch(/couldn['’]t confirm/i)
  })
})

describe('WIRING — both run-gate call sites feed the shared hold reason', () => {
  const sites = runGateCallSites()

  /** The identifier passed as `analysisHeldOn:` at a call site, if it is a bare identifier. */
  function boundIdentifier(args: string): string | null {
    const m = /\banalysisHeldOn\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/.exec(args)
    return m ? m[1] : null
  }
  function readsSharedHook(source: string, ident: string): boolean {
    return new RegExp(`\\bconst\\s+${ident}\\s*=\\s*useAnalysisHoldReason\\(\\s*\\)`).test(source)
  }

  it('finds the call sites (a zero here would make the cases below vacuous)', () => {
    expect(sites.map((s) => s.file).sort()).toEqual([
      'canvas/components/OutputsDock.tsx',
      'canvas/conversation/ConversationPanel.tsx',
    ])
  })

  it.each(sites.map((s) => [s.file, s] as const))('%s', (file, site) => {
    const ident = boundIdentifier(site.args)
    expect(ident, `${file} does not pass a bound hold value`).not.toBeNull()
    const source = blankComments(readFileSync(join(SRC, file), 'utf8'))
    expect(readsSharedHook(source, ident as string), `${file}: \`${ident}\` is not the shared hold reason`).toBe(true)
  })

  it('POSITIVE/NEGATIVE CONTROL — the matcher tells the shared hook from a bypass', () => {
    expect(boundIdentifier('canRunAnalysisUtil({ nodeCount, analysisHeldOn: heldOn, draftStreamPhase })')).toBe('heldOn')
    expect(readsSharedHook('const heldOn = useAnalysisHoldReason()', 'heldOn')).toBe(true)
    // The shape both call sites had before: a raw provenance read.
    expect(readsSharedHook('const heldOn = useCanvasStore((s) => analysisHeldOn(s))', 'heldOn')).toBe(false)
    expect(boundIdentifier('canRunAnalysisUtil({ analysisHeldOn: analysisHeldOn({ nodes }) })')).toBe(null)
  })
})
