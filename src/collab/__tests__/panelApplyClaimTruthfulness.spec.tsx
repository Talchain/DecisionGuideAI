/**
 * COLLAB — what the owner is TOLD when they click "Use Grace's 0.85".
 *
 * ── THE LIE THIS PINS ─────────────────────────────────────────────────────
 * The first version of this flow rendered, in the past tense:
 *
 *     "Your model now uses Grace's 0.85 for "Churn risk after a price rise"."
 *
 * at a point where NOTHING had been applied. This page does not send the turn —
 * it records an intent that the canvas drains after navigation — and
 * `rememberPendingApply` deliberately SWALLOWS its storage failure (private
 * mode, quota) because it is a convenience, not a correctness dependency. So
 * the sentence could be shown having written nothing, sent nothing and changed
 * nothing, and it asserted a completed model change that CEE might still refuse.
 *
 * A confirmation that out-runs its own effect is the defect class this whole
 * slice exists to end, wearing a friendlier sentence — the same shape as the
 * close-failure copy pinned by `panelSetupCloseFailureCopy.spec.tsx`, which
 * asserted "The round is still open" about a round that was closed.
 *
 * ── THE HONEST CONTRACT, and what each half proves ────────────────────────
 * • The claim is PRESENT-CONTINUOUS ("is being applied"), never past, because
 *   present-continuous is exactly what this step established: an intent is
 *   recorded and the model is about to change.
 * • The claim is CONDITIONAL on a READ-BACK of the recorded intent. Recording
 *   and then claiming proves nothing when the write can silently fail.
 * • A failed record shows honest failure copy and NO claim.
 * • The other panellists' answers are named in the same breath, so applying
 *   Grace's number can never read as the panel having agreed on it.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import { rememberOpenRound } from '../openRoundRecord'
import { readPendingApply } from '../panelApplyHandoff'

const SCENARIO_ID = 'scn-apply-9001'
const ROUND_ID = 'rnd-apply-9002'
const OWNER_TOKEN = 'owner-access-token-apply'
const GRACE_ID = 'p-grace'
const ADA_ID = 'p-ada'
const TARGET_ID = 'fac_churn_risk'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

/** Ada 0.2, Grace 0.85 — the acceptance scenario's disagreement. */
const REVEAL = {
  round_id: ROUND_ID,
  status: 'closed',
  graph_version_ref: 'gv-1',
  per_target: [
    {
      target: { kind: 'factor', id: TARGET_ID },
      label: 'Churn risk after a price rise',
      model_value_at_version: 0.4,
      responses: [
        {
          participant_id: ADA_ID,
          display_label: 'Ada',
          value: 0.2,
          expression_raw: "quite unlikely, we've held price before",
          confidence: null,
          kind: 'belief_submitted',
        },
        {
          participant_id: GRACE_ID,
          display_label: 'Grace',
          value: 0.85,
          expression_raw: 'very likely, our contracts renew in Q1',
          confidence: null,
          kind: 'belief_submitted',
        },
      ],
    },
  ],
}

function renderOwnerPanel(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
      <Routes>
        <Route path="/scenario/:id/panel" element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  ;(getSessionIdentity as unknown as Mock).mockResolvedValue({
    accessToken: OWNER_TOKEN,
    userId: 'owner-1',
  })
  rememberOpenRound({
    roundId: ROUND_ID,
    scenarioId: SCENARIO_ID,
    participants: [
      { participant_id: ADA_ID, display_name: 'Ada' },
      { participant_id: GRACE_ID, display_name: 'Grace' },
    ],
  })
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/reveal')) return jsonResponse(REVEAL)
    if (url.includes('/close')) return jsonResponse({ ok: true })
    return jsonResponse({ error: 'unexpected route' }, 404)
  }) as typeof fetchMock
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

/** Drive the page to the reveal, then click Grace's apply button. */
async function revealThenApplyGrace(): Promise<void> {
  renderOwnerPanel()
  // The owner resumes the remembered round and closes it; the close call site
  // falls through to the reveal (the same path panelSetupRoundRecovery pins).
  fireEvent.click(await screen.findByTestId('panel-resume-close'))
  fireEvent.click(await screen.findByTestId(`reveal-apply-${TARGET_ID}-${GRACE_ID}`))
}

describe('panel apply — the claim is truthful about what has actually happened', () => {
  it('⭐ claims PRESENT-CONTINUOUS, never the past tense', async () => {
    await revealThenApplyGrace()
    const status = await screen.findByTestId(`reveal-applied-${TARGET_ID}`)

    // The defect, by identity: the past-tense assertion of a completed change.
    expect(status.textContent).not.toContain('now uses')
    expect(status.textContent).toContain('is being applied')
    expect(status.textContent).toContain('Grace')
    // Percentages since `formatPanelValue` landed. The property is that the
    // claim NAMES THE NUMBER it is applying — unchanged.
    expect(status.textContent).toContain('85%')
  })

  it("⭐ names the other panellists' answers in the same breath", async () => {
    await revealThenApplyGrace()
    const status = await screen.findByTestId(`reveal-applied-${TARGET_ID}`)
    // Applying Grace's number must never read as the panel having agreed.
    expect(status.textContent).toContain('Ada')
    expect(status.textContent).toContain('20%')
    expect(status.textContent).toContain('still recorded below')
  })

  it("⭐ Ada's row and HER OWN apply button both survive the apply", async () => {
    await revealThenApplyGrace()
    // The minority position is never retired: still on screen, still actionable.
    expect(screen.getByTestId(`reveal-response-${ADA_ID}`)).toBeTruthy()
    expect(screen.getByTestId(`reveal-apply-${TARGET_ID}-${ADA_ID}`)).toBeTruthy()
  })

  it('records a drainable intent carrying the EXACT served value', async () => {
    await revealThenApplyGrace()
    await waitFor(() => {
      const intent = readPendingApply(SCENARIO_ID)
      expect(intent).not.toBeNull()
      expect(intent?.participant_id).toBe(GRACE_ID)
      expect(intent?.target_id).toBe(TARGET_ID)
      expect(intent?.value).toBe(0.85)
    })
  })

  it('⭐ makes NO claim when the record could not be held — and says so', async () => {
    // ASSERT-THEN-CLAIM, proven by making the write fail the way it really can:
    // `rememberPendingApply` swallows a throwing setItem by design, so without
    // the read-back the page would still have announced success.
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    try {
      await revealThenApplyGrace()
      const err = await screen.findByTestId(`reveal-apply-error-${TARGET_ID}`)
      expect(err.textContent).toContain('nothing has changed')
      // And crucially: no success claim anywhere.
      expect(screen.queryByTestId(`reveal-applied-${TARGET_ID}`)).toBeNull()
    } finally {
      setItem.mockRestore()
    }
  })

  it('shows no claim and no error BEFORE any apply is clicked', async () => {
    // Control: the surfaces are absent at rest, so their presence above is
    // attributable to the click and not to them always being rendered.
    renderOwnerPanel()
    fireEvent.click(await screen.findByTestId('panel-resume-close'))
    await screen.findByTestId(`reveal-apply-${TARGET_ID}-${GRACE_ID}`)
    expect(screen.queryByTestId(`reveal-applied-${TARGET_ID}`)).toBeNull()
    expect(screen.queryByTestId(`reveal-apply-error-${TARGET_ID}`)).toBeNull()
  })
})
