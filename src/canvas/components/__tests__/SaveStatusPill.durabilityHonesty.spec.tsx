/**
 * ⭐⭐ "Saved 40s ago" WAS A DURABILITY CLAIM NOTHING HAD CONFIRMED.
 *
 * The deployed defect, measured 1 Sep 2026: the top bar read `Saved 40s ago`
 * while the conversation panel still showed drafting as unfinished, and a hard
 * reload then produced ZERO NODES. The claim was not merely early — it was made
 * during precisely the window in which this UI *deliberately refuses to write
 * the graph at all*.
 *
 * `shouldPersistGraphForScenario` is that refusal, and it is the estate's
 * single choke point for `scenarios.graph` writes: while a streamed draft's
 * values are unsettled it returns `false`, so the autosave, its retry and the
 * unmount flush all decline. Meanwhile `lastSavedAt` is a CLIENT-CLOCK stamp
 * taken after an earlier localStorage write (`store.ts`) or after firing an RPC
 * whose return value is discarded (`useScenario.ts`) — so the pill kept
 * counting up from a save that predates, and does not contain, the model on
 * screen.
 *
 * ⚠ THE RULE IS DERIVED FROM THE REFUSAL, NOT RESTATED BESIDE IT. A second
 * predicate answering "may I claim saved?" alongside the one answering "may I
 * write?" is trap 21 exactly — two authorities under similar names that drift
 * into disagreeing about the same instant. `graphWriteWithheldFor` IS
 * `shouldPersistGraphForScenario`'s body; the imperative gate is expressed
 * through it, so they cannot answer differently.
 *
 * The repo already wrote this rule down and never pinned it —
 * `src/test/guestStorageClaims.ts`: "DO NOT SHOW 'Saved' UNTIL SERVER
 * PERSISTENCE HAS ACTUALLY COMPLETED… It needs positive evidence of
 * completion, not a render event." This file is that pin.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveStatusPill } from '../SaveStatusPill'
import { ScenarioSwitcher } from '../ScenarioSwitcher'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import {
  useDraftStore,
  graphWriteWithheldFor,
  shouldPersistGraphForScenario,
  type DraftStreamPhase,
} from '../../stores/draftStore'

const SCENARIO = '11111111-2222-4333-8444-555555555555'
const OTHER = '77777777-6666-4555-8444-333333333333'

describe('⭐⭐ the pill may not assert durability while the graph write is withheld', () => {
  it('withheld → NO "Saved", and no elapsed-time durability claim', () => {
    render(<SaveStatusPill isSaving={false} lastSavedAt={Date.now() - 40_000} graphWriteWithheld />)
    expect(screen.queryByTestId('save-status-saved')).toBeNull()
    expect(screen.queryByText(/Saved/)).toBeNull()
    expect(screen.queryByText(/ago/)).toBeNull()
  })

  it('withheld → says so, rather than saying nothing', () => {
    render(<SaveStatusPill isSaving={false} lastSavedAt={Date.now() - 40_000} graphWriteWithheld />)
    expect(screen.getByTestId('save-status-not-saved')).toBeTruthy()
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Suppressing a false claim must not suppress
   * the true one — otherwise the fix is "delete the feature" wearing a fix's
   * clothes, and no test would notice.
   */
  it('NOT withheld → the honest "Saved … ago" claim still renders', () => {
    render(<SaveStatusPill isSaving={false} lastSavedAt={Date.now() - 40_000} />)
    expect(screen.getByTestId('save-status-saved')).toBeTruthy()
    expect(screen.getByText(/Saved/)).toBeTruthy()
    expect(screen.getByText(/40s ago/)).toBeTruthy()
  })

  it('withheld outranks isSaving — nothing is being written, so "Saving…" is false too', () => {
    render(<SaveStatusPill isSaving lastSavedAt={Date.now()} graphWriteWithheld />)
    expect(screen.queryByTestId('save-status-saving')).toBeNull()
    expect(screen.getByTestId('save-status-not-saved')).toBeTruthy()
  })
})

describe('⭐⭐ the claim is DERIVED from the same rule that withholds the write', () => {
  const PHASES: readonly DraftStreamPhase[] = ['idle', 'drafting', 'settling', 'unsettled']

  beforeEach(() => {
    useDraftStore.setState({ draftStreamPhase: 'idle', draftStreamScenarioId: null } as never)
  })

  it('for EVERY phase, withheld is exactly the negation of the write gate', () => {
    for (const phase of PHASES) {
      useDraftStore.setState({
        draftStreamPhase: phase,
        draftStreamScenarioId: SCENARIO,
      } as never)
      // ⚠ Derived over the whole union, so a fifth phase cannot default to
      // "claimable" — the two answers are one rule or this REDs.
      expect(graphWriteWithheldFor(useDraftStore.getState(), SCENARIO)).toBe(
        !shouldPersistGraphForScenario(SCENARIO),
      )
    }
  })

  it('and it is SCOPED — another scenario’s unsettled draft withholds nothing here', () => {
    useDraftStore.setState({
      draftStreamPhase: 'unsettled',
      draftStreamScenarioId: OTHER,
    } as never)
    expect(graphWriteWithheldFor(useDraftStore.getState(), SCENARIO)).toBe(false)
    expect(graphWriteWithheldFor(useDraftStore.getState(), OTHER)).toBe(true)
  })
})

describe('⭐⭐ WIRING — the real top-bar surface, driven through the real stores', () => {
  /**
   * ⚠ THIS FILE DELIBERATELY DOES NOT MOCK `useCanvasStore`. The existing
   * `ScenarioSwitcher.spec.tsx` replaces the store wholesale and injects
   * `lastSavedAt` directly, which makes the writer — and therefore the entire
   * defect — unreachable from the test. A green suite over a mocked store said
   * nothing about what a user loads (trap 3b).
   */
  beforeEach(() => {
    useCanvasStore.setState(
      { currentScenarioId: SCENARIO, isSaving: false, lastSavedAt: Date.now() - 40_000 } as never,
      false,
    )
    useDraftStore.setState({ draftStreamPhase: 'idle', draftStreamScenarioId: null } as never)
  })

  const mount = () =>
    render(
      <ToastProvider>
        <ScenarioSwitcher />
      </ToastProvider>,
    )

  it('a settling draft on THIS scenario removes the durability claim', () => {
    useDraftStore.setState({
      draftStreamPhase: 'settling',
      draftStreamScenarioId: SCENARIO,
    } as never)
    mount()
    expect(screen.queryByTestId('save-status-saved')).toBeNull()
    expect(screen.getByTestId('save-status-not-saved')).toBeTruthy()
  })

  it('but an idle scenario still shows it — the pair, not one arm', () => {
    mount()
    expect(screen.getByTestId('save-status-saved')).toBeTruthy()
    expect(screen.queryByTestId('save-status-not-saved')).toBeNull()
  })

  it('and a draft settling on ANOTHER scenario does not silence this one', () => {
    useDraftStore.setState({
      draftStreamPhase: 'settling',
      draftStreamScenarioId: OTHER,
    } as never)
    mount()
    expect(screen.getByTestId('save-status-saved')).toBeTruthy()
  })
})
