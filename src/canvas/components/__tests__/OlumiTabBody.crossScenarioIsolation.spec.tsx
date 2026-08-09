/**
 * CROSS-SCENARIO ISOLATION — one decision's private transcript must never
 * appear under another decision, and must never be destroyed by visiting one.
 *
 * ── THE MEASURED DEFECT (independent audit, 9 Aug 2026, finding F2) ─────────
 * "A→B saved A user/assistant messages under B; reload on B exposed them.
 *  Existing focused suites were 45/45 green."
 *
 * The mechanism is an EFFECT ORDER, and it is deterministic. In
 * `useConversation` the persistence effect
 *
 *     useEffect(() => { ... saveTranscript(scenarioId, messages) },
 *               [messages, scenarioId])
 *
 * is DECLARED BEFORE the scenario-switch effect. React runs a commit's effects
 * in declaration order, so on the single render where the scenario changes
 * A→B, `scenarioId` is already B while `messages` is STILL A's — the two pieces
 * of state disagree for exactly one commit, and the first effect writes A's
 * private turns under B's key. The switch effect then runs and clears the
 * panel, so nothing is visible and the poisoning is silent. It surfaces on the
 * next page load, when the record's `pageLoadId` no longer matches and the
 * transcript becomes eligible for restore under the wrong decision.
 *
 * Two further consequences of the same write, both measured here:
 *   · scenario B's OWN stored history is OVERWRITTEN by A's — a user loses the
 *     conversation they are switching to, in order to be shown one they did not
 *     ask for;
 *   · A→B→A does not restore A, because the in-session re-save stamped A's
 *     record with the CURRENT page load and the switch path only restores a
 *     transcript from an earlier one.
 *
 * ── WHY THE FIXTURE IS STATEFUL AND CROSS-SCENARIO ─────────────────────────
 * A fresh-session fixture CANNOT SEE THIS DEFECT. It needs two scenarios and a
 * move between them; with one scenario the two pieces of state never disagree
 * and every assertion passes against the broken code. That is precisely why 45
 * focused transcript/hydration tests were green over it.
 *
 * FIXTURE STATE-CLASS: **seeded** — both scenarios carry a transcript written
 * by an EARLIER page load, which is what "the user has used this product
 * before" actually is. The in-session variant (messages authored during THIS
 * page load, then a switch) is covered by the last test in the second block,
 * whose state-class is **fresh-then-switched**.
 *
 * CLAIM TYPE — read before citing: jsdom renders a DOM, not a layout. The
 * on-screen assertions here are about ELEMENT PRESENCE AND TEXT CONTENT in the
 * mounted tree; they do not prove visibility. The storage assertions are about
 * the exact bytes under `olumi-canvas-transcript`, which is what survives a
 * reload and is therefore the load-bearing claim.
 *
 * MOUNT: rendered through `ConversationProvider` → `OlumiTabBody`, the surface
 * the deployed build actually mounts for the chat pane (CLAUDE.md trap 3b) —
 * not against the hook in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { OlumiTabBody } from '../OlumiTabBody'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'
import { saveTranscript, TRANSCRIPT_STORAGE_KEY } from '../../conversation/utils/transcriptStore'
import type { ConversationMessage } from '../../conversation/types'

// No turn may be dispatched: this exercises restore/persist lifecycle only.
vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: () => new Promise(() => {}),
  streamOrchestratorTurn: async function* () { /* never yields */ },
  OrchestratorError: class extends Error {},
}))
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: () => new Promise(() => {}),
  getV5Endpoint: () => 'https://example.invalid/v5/turn',
}))

/** Two real decisions. Distinct UUIDs — identity, never a value predicate. */
const SCENARIO_A = '561548c3-acd6-4488-b088-399c7cc15631'
const SCENARIO_B = 'c4f1a70e-2b58-4d1a-9a3e-7f0b6c2d8e11'

/**
 * Scenario A's brief. The phrase asserted on is verbatim from the transcript
 * and appears in NO other fixture in this file, so a hit is A's content and
 * nothing else's.
 */
const A_BRIEF =
  'Our NRR is 96% and the board wants 110% by 31 March 2027. Programme cap is £650,000.'
const A_REPLY = 'I have built a first model for the retention programme.'

/** Scenario B's brief — an unrelated decision, with no phrase in common. */
const B_BRIEF = 'Separate decision: should we open a second roastery in Leeds or Sheffield?'
const B_REPLY = 'I have built a first model for the roastery expansion.'

function messagesFor(which: 'a' | 'b'): ConversationMessage[] {
  const brief = which === 'a' ? A_BRIEF : B_BRIEF
  const reply = which === 'a' ? A_REPLY : B_REPLY
  return [
    { id: `${which}-u1`, role: 'user', content: brief, timestamp: new Date('2026-08-08T10:00:00Z') },
    { id: `${which}-a1`, role: 'assistant', content: reply, timestamp: new Date('2026-08-08T10:01:00Z') },
  ]
}

/**
 * Write a transcript and re-stamp it as belonging to an EARLIER page load —
 * which is what "the user closed the tab and came back" is. Same technique as
 * `OlumiTabBody.returningUser.spec.tsx`.
 */
function storePriorSession(scenarioId: string, messages: ConversationMessage[]) {
  saveTranscript(scenarioId, messages)
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[scenarioId].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

/**
 * Simulate a RELOAD: a new page load mints a new `PAGE_LOAD_ID`, which makes
 * every already-stored record "from a previous session". Re-stamping the
 * stored records is byte-equivalent to that, and is the only way to move the
 * discriminator without re-importing the module under a live React tree.
 */
function simulateReload() {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  if (!raw) return
  const file = JSON.parse(raw)
  for (const id of Object.keys(file)) file[id].pageLoadId = 'the-page-load-before-this-one'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

/** The exact bytes stored for one scenario. `null` when nothing is stored. */
function storedFor(scenarioId: string): { messages: { id: string; content: string }[] } | null {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  if (!raw) return null
  const file = JSON.parse(raw)
  return file[scenarioId] ?? null
}

function renderPanel() {
  return render(
    <ConversationProvider>
      <OlumiTabBody />
    </ConversationProvider>,
  )
}

function resetEnvironment() {
  localStorage.clear()
  useCanvasStore.setState({ currentScenarioId: null })
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
}

describe('cross-scenario isolation — A→B must not carry A into B', () => {
  beforeEach(resetEnvironment)

  it("does not write scenario A's turns under scenario B's key", async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const { container } = renderPanel()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    })

    // Bound by IDENTITY: A's own message ids, under B's own key. A value
    // predicate ("some message exists") would be satisfied by B's own turns.
    const b = storedFor(SCENARIO_B)
    const idsUnderB = (b?.messages ?? []).map((m) => m.id)
    expect(idsUnderB).not.toContain('a-u1')
    expect(idsUnderB).not.toContain('a-a1')
    expect(JSON.stringify(b ?? {})).not.toContain('Programme cap is £650,000')
  })

  it("does not DESTROY scenario B's own stored history by visiting A first", async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    storePriorSession(SCENARIO_B, messagesFor('b'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const { container } = renderPanel()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    })

    const idsUnderB = (storedFor(SCENARIO_B)?.messages ?? []).map((m) => m.id)
    expect(idsUnderB).toContain('b-u1')
    expect(idsUnderB).toContain('b-a1')
  })

  it("shows scenario B's OWN conversation after the switch, not A's and not a blank slate", async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    storePriorSession(SCENARIO_B, messagesFor('b'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const { container } = renderPanel()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    })

    await waitFor(() => {
      const bubble = container.querySelector('[data-testid="message-user"]')
      expect(bubble?.textContent ?? '').toContain('second roastery in Leeds or Sheffield')
    })
    expect(container.textContent ?? '').not.toContain('Programme cap is £650,000')
  })

  it("does not expose A's private transcript under B after a RELOAD on B", async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const first = renderPanel()
    await waitFor(() => {
      expect(first.container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    })
    first.unmount()

    // The user reloads while sitting on B.
    simulateReload()
    useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    const second = renderPanel()

    await waitFor(() => {
      expect(second.container.textContent ?? '').not.toContain('Programme cap is £650,000')
    })
    expect(second.container.querySelector('[data-testid="message-user"]')).toBeNull()
  })
})

describe('cross-scenario isolation — the switch must not cost the user their work', () => {
  beforeEach(resetEnvironment)

  it('restores A when the user returns A→B→A in the same page load', async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const { container } = renderPanel()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    })
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SCENARIO_A })
    })

    await waitFor(() => {
      const bubble = container.querySelector('[data-testid="message-user"]')
      expect(bubble?.textContent ?? '').toContain('Programme cap is £650,000')
    })
  })

  /**
   * ── POSITIVE CONTROL (trap 13b) ─────────────────────────────────────────
   * Every isolation assertion above is an ABSENCE. A "fix" that simply stopped
   * persisting anything would satisfy all of them while destroying the feature.
   * This test asserts the PRESENCE the isolation must not cost: a transcript
   * still reaches storage under the scenario it belongs to.
   */
  it('still persists a scenario\'s own transcript under its own key', async () => {
    storePriorSession(SCENARIO_A, messagesFor('a'))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_A })

    const { container } = renderPanel()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="message-user"]')).not.toBeNull()
    })

    const idsUnderA = (storedFor(SCENARIO_A)?.messages ?? []).map((m) => m.id)
    expect(idsUnderA).toContain('a-u1')
    expect(idsUnderA).toContain('a-a1')
  })
})
