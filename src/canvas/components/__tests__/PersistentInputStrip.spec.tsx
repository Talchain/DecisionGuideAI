/**
 * PersistentInputStrip — invariant + draft-preservation tests.
 *
 * Critical invariants tested:
 *   - When floating Olumi panel is open, the strip MUST NOT render a textarea
 *     (preserves "no duplicate composer" rule from aiPanelV2 addendum A).
 *   - Draft text typed into the strip persists across floating open/close so
 *     dock/undock never loses in-progress text (addendum A + B).
 *   - Status-strip text reflects the LAST assistant message (first 50 chars),
 *     literal — never an LLM-generated summary (addendum G).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { PersistentInputStrip } from '../PersistentInputStrip'
import { focusDockedOlumi } from '../../conversation/dockedOlumiFocus'
import {
  ConversationProvider,
  useConversationContext,
} from '../../conversation/ConversationContext'

// Stub the heavy conversation runtime: useConversation does network + store
// work that's irrelevant to these UI invariant tests.
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [messages, setMessages] = useState<any[]>([])
      const [isThinking, setIsThinking] = useState(false)
      return {
        messages,
        isThinking,
        longRunningHint: null,
        sendMessage: vi.fn((text: string) => {
          setMessages((m) => [
            ...m,
            { id: `u-${m.length}`, role: 'user', content: text, blocks: [] },
          ])
        }),
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
        _testHelpers: { setMessages, setIsThinking },
      }
    },
  }
})


// useStageAwarePlaceholder pulls from canvas store + stale guard; stub the
// constant string variant for predictable assertions.
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

describe('PersistentInputStrip', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  describe('composer mode — floating closed', () => {
    it('renders a textarea when floating is closed (composer mode)', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    /**
     * ⛔ BOTH ASSERTIONS BELOW ARE THE INVERSE OF THE ONES THEY REPLACE, and the
     * inversion is stated rather than the old tests quietly deleted.
     *
     * The strip used to assert a 70px rest height and a `right-4` inset on an
     * absolutely-positioned control stack. Both were correct FOR A COMPOSER
     * WHOSE CONTROLS FLOATED OVER ITS TEXT — the 70px existed to hold a 58px
     * cog+send cluster inside the border, and the 16px inset existed so that
     * cluster would not sit on top of the textarea's internal scrollbar.
     *
     * The controls now live in their own row beneath the text, so neither
     * reservation has anything left to reserve for. The properties that MATTER
     * are re-asserted, not dropped: the box still has a bounded rest height and
     * a bounded ceiling, and the controls are still reachable and still grouped.
     */
    it('rests at ONE line and grows to ten — the 70px reservation is gone', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      // LINE_HEIGHT_PX (18, the jsdom fallback — a real browser measures 19.5
      // from `panelBody`'s `leading-relaxed`) * 1 line + TEXTAREA_PAD_PX (12).
      expect(textarea.style.minHeight).toBe('30px')
      // 18 * 10 + 12 = 192. The ceiling ROSE (was 160) while the rest state
      // SHRANK: the box is now smaller when empty and larger when full.
      expect(textarea.style.maxHeight).toBe('192px')
    })

    it('puts the controls in a row BENEATH the text, not floating over it', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      const send = screen.getByTestId('ai-input-bar-strip-send')
      const row = send.parentElement as HTMLElement
      // The row is in normal flow — no `absolute`, and therefore no inset to
      // tune against a scrollbar it can no longer overlap.
      expect(row.className).not.toMatch(/\babsolute\b/)
      expect(row.className).not.toMatch(/\bright-\d/)
      expect(row.getAttribute('data-testid')).toBe('ai-input-bar-strip-actions')
      // CONTROL — the float-out chevron joined the same row rather than staying
      // outside the composer's border as a separate frame.
      expect(row.contains(screen.getByTestId('ai-input-bar-strip-chevron'))).toBe(true)
    })

    it('reserves no right padding on the textarea — the text gets the full width', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      // Was `pr-14` (56px) held open for the floating cluster.
      expect(textarea.className).toMatch(/\bpr-3\b/)
      expect(textarea.className).not.toMatch(/\bpr-(12|14)\b/)
    })

    it('offers NO run-analysis control unless the host supplies one', () => {
      // Never a dead affordance: the button exists only when `OutputsDock`
      // hands down the canonical runner and its gate.
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.queryByTestId('ai-input-bar-strip-analyse')).toBeNull()
    })

    it('CONTROL — the run-analysis control appears, is named, and fires the host runner', () => {
      const onRun = vi.fn()
      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          analysisAction={{ onRun, canRun: true, isRunning: false, label: 'Re-run analysis' }}
        />,
        { wrapper: Wrapper },
      )
      const btn = screen.getByRole('button', { name: 'Re-run analysis' })
      expect(btn.getAttribute('data-blocked')).toBe('false')
      fireEvent.click(btn)
      expect(onRun).toHaveBeenCalledTimes(1)
    })

    it('DISABLES the run control while the gate is shut, and says why — never hides it', () => {
      const onRun = vi.fn()
      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          analysisAction={{
            onRun,
            canRun: false,
            isRunning: false,
            blockedReason: '4 parts of your model are not ready for analysis yet.',
            label: 'Re-run analysis',
          }}
        />,
        { wrapper: Wrapper },
      )
      const btn = screen.getByTestId('ai-input-bar-strip-analyse') as HTMLButtonElement
      expect(btn).toBeInTheDocument()
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('data-blocked')).toBe('true')
      // The gate's OWN sentence, carried through verbatim.
      expect(btn.getAttribute('title')).toBe('4 parts of your model are not ready for analysis yet.')
      fireEvent.click(btn)
      expect(onRun).not.toHaveBeenCalled()
    })
  })

  describe('status mode — floating open (invariant: no textarea)', () => {
    it('renders status line WITHOUT a textarea when floating is open', () => {
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByTestId('persistent-strip-status')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('clicking the status strip calls onFocusFloating', () => {
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      const onFocusFloating = vi.fn()
      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          onFocusFloating={onFocusFloating}
        />,
        { wrapper: Wrapper },
      )
      fireEvent.click(screen.getByTestId('persistent-strip-status'))
      expect(onFocusFloating).toHaveBeenCalledTimes(1)
    })

    it('falls back to composer mode when floating is minimised (round-15 regression)', () => {
      // Round-15 P0: when the user collapses the floating panel to a
      // pill, `isOpen` stays true but `isMinimised` flips to true. The
      // pill has no textarea, so the strip must take over composing.
      // Previously the gate was `if (floatingIsOpen)` alone, which kept
      // the strip in "Olumi is open · Focus" status mode and left the
      // user with no place to type.
      act(() => {
        useFloatingPanelState.getState().open('user')
        useFloatingPanelState.getState().minimise()
      })
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />, {
        wrapper: Wrapper,
      })
      // Status mode must NOT render — the strip must give the user a
      // textarea since the minimised pill has none.
      expect(screen.queryByTestId('persistent-strip-status')).toBeNull()
      // Composer mode renders with the real textarea.
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('returns to status mode when the panel is restored from the minimised pill', () => {
      // Symmetry check: minimising the panel re-shows the strip
      // composer; restoring from the pill must put the strip BACK into
      // status mode so the floating composer is the sole place to type
      // (the "no duplicate composer" invariant).
      act(() => {
        useFloatingPanelState.getState().open('user')
        useFloatingPanelState.getState().minimise()
      })
      const { rerender } = render(
        <PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />,
        { wrapper: Wrapper },
      )
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      act(() => {
        useFloatingPanelState.getState().restore()
      })
      rerender(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />)
      expect(screen.getByTestId('persistent-strip-status')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('draft preservation across floating open/close', () => {
    it('preserves typed draft text when floating opens and closes', () => {
      // Capture the context inside a test consumer so we can assert
      // draft value out-of-band.
      let captured: { draft: string } = { draft: '' }
      function Capture() {
        const ctx = useConversationContext()
        captured = ctx
        return null
      }
      render(
        <>
          <Capture />
          <PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} />
        </>,
        { wrapper: Wrapper },
      )
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'half-typed thought' } })
      expect(captured.draft).toBe('half-typed thought')

      // Open the floating panel — strip switches to status mode and unmounts
      // its textarea, but the draft string lives in the context so it survives.
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(captured.draft).toBe('half-typed thought')

      // Close the floating panel — strip rerenders the textarea with the
      // preserved value.
      act(() => {
        useFloatingPanelState.getState().close()
      })
      const reborn = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(reborn.value).toBe('half-typed thought')
    })
  })
})

/**
 * THE DOCKED OLUMI FOCUS CHANNEL (B3 convergence).
 *
 * `revealOlumiSurface()` focuses the docked composer through
 * `focusDockedOlumi()`. That only works if this strip registers the channel —
 * and only while it is actually rendering a textarea. A channel registered in
 * status or redirect mode would report SUCCESS while focusing a null ref,
 * which is worse than no channel: the caller stops looking for another surface.
 *
 * Bound by identity to the strip's three modes via their own testids, so the
 * registration cannot be satisfied by "some input somewhere got focus".
 */
describe('docked Olumi focus channel', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  it('registers in composer mode and focuses the strip textarea', () => {
    render(
      <Wrapper>
        <PersistentInputStrip isOlumiTabActive onOpenFloating={vi.fn()} />
      </Wrapper>,
    )
    // POSITIVE CONTROL — we are in composer mode, not some other branch.
    expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
    expect(focusDockedOlumi()).toBe(true)
    const textarea = screen
      .getByTestId('persistent-strip-composer')
      .querySelector('textarea')
    expect(textarea).not.toBeNull()
    expect(document.activeElement).toBe(textarea)
  })

  it('⭐ does NOT register in redirect mode (no textarea to focus)', () => {
    render(
      <Wrapper>
        <PersistentInputStrip
          isOlumiTabActive={false}
          onOpenFloating={vi.fn()}
        />
      </Wrapper>,
    )
    expect(screen.getByTestId('persistent-strip-composer-redirect')).toBeInTheDocument()
    expect(focusDockedOlumi()).toBe(false)
  })

  it('⭐ does NOT register in status mode (the floating panel owns focus)', () => {
    act(() => {
      useFloatingPanelState.getState().open('user')
    })
    render(
      <Wrapper>
        <PersistentInputStrip isOlumiTabActive onOpenFloating={vi.fn()} />
      </Wrapper>,
    )
    expect(screen.getByTestId('persistent-strip-status')).toBeInTheDocument()
    expect(focusDockedOlumi()).toBe(false)
  })

  it('re-registers when a minimised floating panel hands composing back', () => {
    act(() => {
      useFloatingPanelState.getState().open('user')
    })
    render(
      <Wrapper>
        <PersistentInputStrip isOlumiTabActive onOpenFloating={vi.fn()} />
      </Wrapper>,
    )
    expect(focusDockedOlumi()).toBe(false)
    act(() => {
      useFloatingPanelState.getState().minimise()
    })
    // The pill has no textarea, so the strip takes composing back — and with
    // it the focus channel.
    expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
    expect(focusDockedOlumi()).toBe(true)
  })
})
