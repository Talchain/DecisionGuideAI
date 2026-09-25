/**
 * An option target the model REFUSED must say so, and an amount typed the way
 * the card shows it must reach the model — through the REAL chain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECTS — served UI `a4434670`, 24 Sep 2026, CDP starter, inspector tech
 * view (MANUAL-EDIT-PROOF-20260924.md rows 3c–3f)
 * ─────────────────────────────────────────────────────────────────────────────
 * D2. On "Adopt Segment", the GDPR row (plain 0–1) and the Annual Platform Cost
 *     row were answered **422 `system_event_refused_no_write`**. The inspector
 *     said NOTHING; the field kept the typed number; reopening showed the old
 *     value. Root cause: `useOptionInterventionCommit` called
 *     `proposeOptionIntervention` WITHOUT `onSendSettled`, so no settlement ever
 *     reached this surface — and `settleSystemEventSend` read only
 *     `details.conflict_category`, so even a listener would have heard
 *     "unverified" about a refusal the producer states wrote nothing.
 * D3. The card reads "£60k"; the field read `0.5` and parsed with `parseFloat`.
 *     `80000` was refused as off-scale, `£80,000` and `80k` read as nothing,
 *     and anything unreadable was silently reset.
 *
 * WHAT IS REAL: `OptionPanel` (with `readOnly`, exactly as `InspectorRouter`
 * mounts it) → `InterventionRow` → `useOptionInterventionCommit` →
 * `useModelEditAuthority.proposeOptionIntervention` → the REAL
 * `ConversationProvider`/`useConversation` → `callV5Turn` → parse → route →
 * `SystemEventSendError` → `settleSystemEventSend`. Only global `fetch` is a
 * double; its 422 body is CEE's `buildCommitFailureBoundaryError` shape at the
 * served CEE SHA `3f412be1`.
 *
 * ⭐ THE PATTERN IS EXPERIENCE DESIGN'S (#63 5806266691, S2): `Not saved ·
 * <specific reason>` directly under the field, the typed value kept in the
 * field, retry/change/discard as appropriate, and the readout above the field
 * still showing the last saved value. The reason for CEE's
 * `invalid_existing_intervention` is OpenAI Connected's copy (OC-1). The wire
 * does not name that cause (CEE staging `778f1fde`: the 422 carries only
 * `system_event_refused_no_write`), so it is read off the stored entry the edit
 * would replace — pinned below with a discriminating twin: the SAME 422 on a
 * row whose stored entry has a recorded source says the generic declined line.
 *
 * CLAIM SCOPE (trap 3): jsdom proves dispatch, text and state — never layout,
 * and never mouse targeting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

import { OptionPanel } from '../panels/OptionPanel'
import {
  OPTION_INTERVENTION_NOT_SAVED_CONFLICT,
  OPTION_INTERVENTION_NOT_SAVED_DECLINED,
  OPTION_INTERVENTION_UNCONFIRMED,
} from '../shared/useOptionInterventionCommit'
import { ConversationProvider } from '../../../conversation/ConversationContext'
import { useCanvasStore } from '../../../store'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const OPTION_ID = 'opt_segment'
/** "Annual platform cost £60k · same as baseline" — no `source`, a £ factor. */
const COST = 'fac_annual_cost'
/** The GDPR row — no unit, plain 0–1, no `source`. */
const GDPR = 'fac_gdpr'
const CAP = 120000

// ── The transport double: every request body, and a queue of answers ────────
const sentBodies: Array<Record<string, unknown>> = []
const answers: Array<{ status: number; body: unknown }> = []

function stubFetch() {
  const fetchStub = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    if (typeof init?.body === 'string') sentBodies.push(JSON.parse(init.body))
    const { status, body } = answers.shift() ?? { status: 200, body: OK_BODY }
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const OK_BODY = {
  response_version: 2,
  assistant_text: 'Noted.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

/** CEE `buildCommitFailureBoundaryError` at `3f412be1` — the witnessed 422. */
const REFUSED_NO_WRITE_422 = {
  error: 'INGRESS_CONTRACT_VIOLATION',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    reason: 'system_event_refused_no_write',
    event_kind: 'option_intervention_edit',
    stage: 'frame',
  },
  request_id: 'req_cdp_1',
  retryable: false,
}

/** Same builder, the opposite guarantee: a writer that could NOT confirm its commit. */
const COMMIT_UNCONFIRMED_500 = {
  ...REFUSED_NO_WRITE_422,
  error: 'INTERNAL_ERROR',
  details: { ...REFUSED_NO_WRITE_422.details, retryable: true, reason: 'system_event_commit_failed' },
  retryable: true,
}

/** The option_intervention_edit events that reached the transport, in order. */
function sentOptionTargetEdits(): Array<Record<string, unknown>> {
  return sentBodies
    .map((b) => (b.system_event ?? b.event ?? null) as Record<string, unknown> | null)
    .filter((e): e is Record<string, unknown> => e !== null)
    .filter((e) => e.kind === 'option_intervention_edit' || e.type === 'option_intervention_edit')
}

/** `gdprSource` stamps the GDPR entry — the discriminating twin of the witnessed, source-less row. */
function seed({ gdprSource }: { gdprSource?: string } = {}) {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      lastServerGraphHash: '77d05bb3aaaaaaaa',
      nodes: [
        {
          id: OPTION_ID,
          type: 'option',
          position: { x: 0, y: 0 },
          data: {
            label: 'Adopt Segment',
            kind: 'option',
            interventions: {
              [COST]: { value: 0.5, display_value: '£60k' },
              [GDPR]: gdprSource ? { value: 0.5, source: gdprSource } : { value: 0.5 },
            },
          },
        } as unknown as Node,
        {
          id: COST,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Annual Platform Cost',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.5, raw_value: 60000, cap: CAP, unit: '£' },
          },
        } as unknown as Node,
        {
          id: GDPR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'GDPR Compliance Readiness',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.5 },
          },
        } as unknown as Node,
      ],
      edges: [
        { id: 'e1', source: OPTION_ID, target: COST, data: {} },
        { id: 'e2', source: OPTION_ID, target: GDPR, data: {} },
      ],
      results: { status: 'idle', report: null },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never,
    false,
  )
}

/** Tech view, as the witness used it: rows with a `display_value` show their input only there. */
const renderPanel = () =>
  render(
    <ConversationProvider>
      <OptionPanel nodeId={OPTION_ID} techMode onClose={() => {}} onNavigate={() => {}} readOnly />
    </ConversationProvider>,
  )

/** The input inside THIS factor's row — bound by row identity, never by position. */
function inputFor(factorId: string): HTMLInputElement {
  const row = document.querySelector(`[data-testid="inspector-intervention-${factorId}"]`)
  expect(row, `no row for ${factorId}`).toBeTruthy()
  const input = row!.querySelector('input')
  expect(input, `no editable input on ${factorId}`).toBeTruthy()
  return input as HTMLInputElement
}

/** Type and press Enter — the witnessed gesture. */
async function typeAndEnter(factorId: string, text: string) {
  const input = inputFor(factorId)
  await act(async () => {
    input.focus()
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

beforeEach(() => {
  sentBodies.length = 0
  answers.length = 0
  stubFetch()
  seed()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('D2 — a refused option target says "Not saved · <reason>" under its field, and keeps the typed value', () => {
  it('⭐ 422 `system_event_refused_no_write` on the witnessed source-less row → a truthful no-write line under the field — RED at a4434670 (silence)', async () => {
    answers.push({ status: 422, body: REFUSED_NO_WRITE_422 })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    // ⛔ Codex 5807262127: the 422 proves NO WRITE, not WHY. A locally source-less
    // row is not evidence of the cause, so the line is the generic declined one.
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_DECLINED)
    expect(line.textContent).toBe('Not saved · this change was refused, so the model is unchanged.')
    expect(line.textContent ?? '').not.toMatch(/no recorded source/i)
    // The machine token is never shown to the reader.
    expect(line.textContent ?? '').not.toMatch(/system_event_refused_no_write|invalid_existing/)
    // Directly under THIS field: the field points at it.
    expect(inputFor(GDPR).getAttribute('aria-describedby')).toBe(line.id)

    // The value the reader typed STAYS in the field, marked.
    expect(inputFor(GDPR).value).toBe('0.7')
    expect(inputFor(GDPR)).toHaveAttribute('aria-invalid', 'true')
    // Discard is offered; retry is NOT — the producer says repeating cannot succeed.
    expect(screen.getByTestId(`intervention-unapplied-dismiss-${GDPR}`).textContent).toBe('Discard')
    expect(screen.queryByTestId(`intervention-unapplied-retry-${GDPR}`)).toBeNull()
    // One sentence, in one place: the list-level notice does not repeat it.
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
    // Identity: the OTHER row is untouched.
    expect(screen.queryByTestId(`intervention-unapplied-${COST}`)).toBeNull()
  })

  /**
   * A GRAPH_DIVERGED 409 in the WITNESSED envelope: `useConversation.fence409Honesty.spec.ts`'s
   * `fence409Body` (journey-walk §4/§8, the producer's literal shape from CEE `turn-executor.ts`).
   * The `boundary` / `direction` / `validator` fields are load-bearing: without them the body is
   * not a BoundaryError, the router takes the parse-error path, and the send settles
   * `unverified` whatever the category (measured: a first draft of this fixture without them
   * made the BASE_HASH_DIVERGED contrast read "Could not confirm"). The fence verdict is
   * dormant on this carrier today (CEE emits it on `factor_value_edit` only), so this pins the
   * copy before CEE widens it.
   */
  const graphDiverged409 = (category: string) => ({
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      phase: 'commit',
      conflict_category: category,
      ...(category.startsWith('turn_fence_') ? { fence_verdict: category.slice('turn_fence_'.length) } : {}),
    },
    request_id: `req_${category}`,
    retryable: false,
  })

  it('⭐ 409 `turn_fence_stopped` → the fence\'s own sentence under the field, never "the model changed"', async () => {
    answers.push({ status: 409, body: graphDiverged409('turn_fence_stopped') })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe("That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it.")
    expect(line.textContent ?? '').not.toMatch(/model changed/i)
    expect(inputFor(GDPR).value).toBe('0.7')
  })

  it('CONTRAST — 409 `BASE_HASH_DIVERGED` keeps the conflict line, exactly', async () => {
    answers.push({ status: 409, body: graphDiverged409('BASE_HASH_DIVERGED') })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_CONFLICT)
  })

  it('⭐ CONTRAST — the same 422 on a row whose stored entry HAS a source says the same generic line (the local source never decides the copy)', async () => {
    seed({ gdprSource: 'brief_extraction' })
    answers.push({ status: 422, body: REFUSED_NO_WRITE_422 })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_DECLINED)
    expect(line.textContent).toBe('Not saved · this change was refused, so the model is unchanged.')
    // Not the conflict line and not the hedge — the producer stated the no-write.
    expect(line.textContent ?? '').not.toMatch(/changed while|could not confirm|no recorded source/i)
  })

  it('⭐ the readout keeps the last SAVED value; only the field holds the rejected £ amount (ED S2)', async () => {
    answers.push({ status: 422, body: REFUSED_NO_WRITE_422 })
    renderPanel()

    await typeAndEnter(COST, '£80,000')

    const line = await screen.findByTestId(`intervention-unapplied-${COST}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_DECLINED)
    expect(inputFor(COST).value).toBe('80,000')
    const readout = screen.getByTestId(`intervention-readout-${COST}`).textContent ?? ''
    expect(readout).toContain('£60k')
    expect(readout).not.toMatch(/80/)
  })

  it('Discard puts the SAVED value back and clears the line', async () => {
    answers.push({ status: 422, body: REFUSED_NO_WRITE_422 })
    renderPanel()
    await typeAndEnter(GDPR, '0.7')
    await screen.findByTestId(`intervention-unapplied-${GDPR}`)

    fireEvent.click(screen.getByTestId(`intervention-unapplied-dismiss-${GDPR}`))

    await waitFor(() => expect(inputFor(GDPR).value).toBe('0.5'))
    expect(screen.queryByTestId(`intervention-unapplied-${GDPR}`)).toBeNull()
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
    expect(inputFor(GDPR)).not.toHaveAttribute('aria-invalid')
  })

  it('Enter on the unapplied value is the retry — it sends again, and a blur alone never does', async () => {
    answers.push({ status: 422, body: REFUSED_NO_WRITE_422 })
    renderPanel()
    await typeAndEnter(GDPR, '0.7')
    await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(sentOptionTargetEdits()).toHaveLength(1)

    // A focus-and-leave is not a request.
    const input = inputFor(GDPR)
    await act(async () => {
      input.focus()
      fireEvent.blur(input)
    })
    expect(sentOptionTargetEdits()).toHaveLength(1)

    // Enter is.
    await act(async () => {
      input.focus()
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(2))
  })

  it('⭐ the retryable 500 (commit not confirmed) says "Could not confirm", never "Not saved", and offers Try again — RED at a4434670 (silence)', async () => {
    answers.push({ status: 500, body: COMMIT_UNCONFIRMED_500 })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_UNCONFIRMED)
    expect(line.textContent ?? '').toMatch(/^Could not confirm · /)
    expect(line.textContent ?? '').not.toMatch(/not saved/i)
    expect(inputFor(GDPR).value).toBe('0.7')

    // Setting a target is idempotent, so the retry is offered — and it sends.
    const retry = screen.getByTestId(`intervention-unapplied-retry-${GDPR}`)
    expect(retry.textContent).toBe('Try again')
    fireEvent.click(retry)
    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(2))
    expect(sentOptionTargetEdits()[1].value).toBe(0.7)
  })

  it('CONTRAST — an accepted send shows no line and no unapplied mark', async () => {
    answers.push({ status: 200, body: OK_BODY })
    renderPanel()

    await typeAndEnter(GDPR, '0.7')

    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
    // Let the settlement land before asserting its absence.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
    expect(screen.queryByTestId(`intervention-unapplied-${GDPR}`)).toBeNull()
    expect(inputFor(GDPR)).not.toHaveAttribute('aria-invalid')
  })
})

describe('D3 — a £ target takes the amount the card shows, and says why when it cannot', () => {
  it('the field shows the card\'s figure in £, not the model value', () => {
    renderPanel()
    expect(inputFor(COST).value).toBe('60,000')
    const row = screen.getByTestId(`inspector-intervention-${COST}`)
    expect(row.textContent ?? '').toContain('£')
    // The model-scale qualifier belongs to model-scale rows only.
    expect(row.textContent ?? '').not.toMatch(/model value/)
  })

  it.each(['80000', '80,000', '£80,000', '80k', '£80k'])(
    '⭐ "%s" reaches the model as 80,000 / cap — RED at a4434670 (no request)',
    async (typed) => {
      renderPanel()

      await typeAndEnter(COST, typed)

      await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
      const event = sentOptionTargetEdits()[0]
      expect(event.option_id).toBe(OPTION_ID)
      expect(event.factor_id).toBe(COST)
      expect(event.value as number).toBeCloseTo(80000 / CAP, 12)
      expect(screen.queryByTestId(`intervention-entry-refusal-${COST}`)).toBeNull()
    },
  )

  it('⭐ an unreadable entry says why, keeps the text, and sends nothing — RED at a4434670 (silent reset)', async () => {
    renderPanel()

    await typeAndEnter(COST, 'about eighty')

    const refusal = await screen.findByTestId(`intervention-entry-refusal-${COST}`)
    expect(refusal).toHaveAttribute('role', 'alert')
    expect(refusal.textContent).toBe('Not saved · not a number this row can read. Enter an amount such as £60,000.')
    expect(inputFor(COST).getAttribute('aria-describedby')).toBe(refusal.id)
    expect(inputFor(COST).value).toBe('about eighty')
    expect(inputFor(COST)).toHaveAttribute('aria-invalid', 'true')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it('Escape discards the typed text and sends nothing', async () => {
    renderPanel()
    const input = inputFor(GDPR)
    await act(async () => {
      input.focus()
      fireEvent.change(input, { target: { value: '0.9' } })
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(sentOptionTargetEdits()).toHaveLength(0)
    expect(inputFor(GDPR).value).toBe('0.5')
  })

  it('an amount past the factor\'s scale names the range in £ and sends nothing', async () => {
    renderPanel()

    await typeAndEnter(COST, '£200,000')

    const refusal = await screen.findByTestId(`intervention-entry-refusal-${COST}`)
    expect(refusal.textContent).toBe('Not saved · must be between £0 and £120,000 for this factor.')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it('CONTRAST — a model-scale row keeps its model-scale seed and sends on the model scale', async () => {
    // Green at a4434670 too: a row with no unit is not moved onto a £ frame.
    renderPanel()
    expect(inputFor(GDPR).value).toBe('0.5')

    await typeAndEnter(GDPR, '0.7')

    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
    expect(sentOptionTargetEdits()[0].factor_id).toBe(GDPR)
    expect(sentOptionTargetEdits()[0].value).toBe(0.7)
  })

  it('⭐ a unit typed on a model-scale row is refused WITH a reason, not read as 70 or 0.7', async () => {
    renderPanel()

    await typeAndEnter(GDPR, '70%')

    const refusal = await screen.findByTestId(`intervention-entry-refusal-${GDPR}`)
    expect(refusal.textContent).toBe(
      'Not saved · this row is on the model scale. Enter a plain number between 0 and 1.',
    )
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })
})

/**
 * MANUAL-EDIT-REWITNESS-0753Z N1, 24 Sep 2026 — rows 5b/5c on served UI
 * `25314672`: a real stale-base 409 on the OpenAI lane read "Could not confirm ·
 * the model may or may not have this value…" with [Try again], and Try again
 * re-sent the same stale base into the same 409. The body carried the lane's
 * `_diagnostic_trace` + `_provider_calls`, which the strict error schema refused.
 */
const LANE_SIDECARS = {
  _diagnostic_trace: { exit_path: 'agent_lane_forwarded', forwarded_kind: 'system_event' },
  _provider_calls: [],
}

/** The witnessed 409 (rewitness row 5b), in `route-v2.ts`'s envelope. */
const STALE_BASE_409 = {
  error: 'GRAPH_DIVERGED',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    reason: 'graph_write_conflict',
    conflict_category: 'stale_base_graph_hash',
    recovery_action: 'refresh_and_reconfirm',
    expected_base_graph_hash: '00b6c7c26699cc11',
    event_kind: 'option_intervention_edit',
  },
  request_id: 'req_cdp_409',
  retryable: false,
}

describe('N1 — a refusal the OpenAI lane delivers says "Not saved", and offers no retry that cannot succeed', () => {
  it('⭐ stale-base 409 + lane sidecars → the conflict line, no Try again — RED at 25314672 ("Could not confirm" + Try again)', async () => {
    answers.push({ status: 409, body: { ...STALE_BASE_409, ...LANE_SIDECARS } })
    renderPanel()

    await typeAndEnter(GDPR, '0.65')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_CONFLICT)
    expect(line.textContent).toBe(
      'Not saved · the model changed while this was sending, so nothing was written. Ask Olumi anything, then set this again.',
    )
    expect(line.textContent ?? '').not.toMatch(/could not confirm|may or may not/i)
    // Repeating the same send hits the same stale base, so no retry is offered.
    expect(screen.queryByTestId(`intervention-unapplied-retry-${GDPR}`)).toBeNull()
    expect(screen.getByTestId(`intervention-unapplied-dismiss-${GDPR}`).textContent).toBe('Discard')
    expect(inputFor(GDPR).value).toBe('0.65')
    expect(sentOptionTargetEdits()).toHaveLength(1)
  })

  it('⭐ 422 `system_event_refused_no_write` + lane sidecars → the declined line — RED at 25314672', async () => {
    answers.push({ status: 422, body: { ...REFUSED_NO_WRITE_422, ...LANE_SIDECARS } })
    renderPanel()

    await typeAndEnter(GDPR, '0.55')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_NOT_SAVED_DECLINED)
    expect(screen.queryByTestId(`intervention-unapplied-retry-${GDPR}`)).toBeNull()
  })

  it('⛔ CONTRAST — an undeclared NON-underscore root key is not a sidecar: the hedge stays, with its retry', async () => {
    answers.push({ status: 409, body: { ...STALE_BASE_409, ...LANE_SIDECARS, recovery: { action: 'reload' } } })
    renderPanel()

    await typeAndEnter(GDPR, '0.65')

    const line = await screen.findByTestId(`intervention-unapplied-${GDPR}`)
    expect(line.textContent).toBe(OPTION_INTERVENTION_UNCONFIRMED)
    expect(screen.getByTestId(`intervention-unapplied-retry-${GDPR}`).textContent).toBe('Try again')
  })
})
