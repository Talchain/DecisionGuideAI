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
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { PersistentInputStrip } from '../PersistentInputStrip'
import { EMPTY_EDGE_STRENGTH_SYNC, useCanvasStore } from '../../store'
import {
  ConversationProvider,
  useConversationContext,
} from '../../conversation/ConversationContext'

const mockRefreshEdgeStrengthAuthority = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockOpenEdgeStrengthRecoveryRelationship = vi.hoisted(() => vi.fn(() => true))

vi.mock('../../edge-strength/edgeStrengthCoordinator', () => ({
  refreshEdgeStrengthAuthority: mockRefreshEdgeStrengthAuthority,
  openEdgeStrengthRecoveryRelationship: mockOpenEdgeStrengthRecoveryRelationship,
}))

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
    mockRefreshEdgeStrengthAuthority.mockReset()
    mockRefreshEdgeStrengthAuthority.mockResolvedValue(true)
    mockOpenEdgeStrengthRecoveryRelationship.mockReset()
    mockOpenEdgeStrengthRecoveryRelationship.mockReturnValue(true)
    useCanvasStore.setState({
      currentScenarioId: null,
      nodes: [],
      edges: [],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      showInspectorPanel: false,
      unconfirmedEmittedEdits: 0,
      edgeStrengthSync: EMPTY_EDGE_STRENGTH_SYNC,
    } as never)
  })

  describe('canonical relationship recovery on the mounted AI Panel v2 strip', () => {
    it('keeps an inspector-closed conflict visible and keyboard-native by endpoint', async () => {
      const user = userEvent.setup()
      useCanvasStore.setState({
        currentScenarioId: 'scenario-1',
        nodes: [
          { id: 'fac_demand', data: { label: 'Demand' } },
          { id: 'goal_profit', data: { label: 'Sustainable profit' } },
        ],
        edges: [{
          id: 'rf-secret-edge-id',
          source: 'fac_demand',
          target: 'goal_profit',
          data: {},
        }],
        showInspectorPanel: false,
        edgeStrengthSync: {
          ...EMPTY_EDGE_STRENGTH_SYNC,
          scenarioId: 'scenario-1',
          hydration: 'settled',
          issue: 'conflict',
          recoverySummary: {
            items: [{
              from: 'fac_demand',
              to: 'goal_profit',
              label: 'Demand → Sustainable profit',
              kind: 'conflict',
              relationshipExists: true,
            }],
            total: 1,
            remaining: 0,
          },
        },
      } as never)

      render(
        <PersistentInputStrip
          isOlumiTabActive={false}
          onOpenFloating={() => {}}
          onCogClick={() => {}}
          recoveryBlockedReason="Demand → Sustainable profit changed elsewhere. Review the latest shared value before running analysis."
        />,
        { wrapper: Wrapper },
      )

      expect(screen.getByTestId('edge-strength-recovery-notice')).toBeVisible()
      expect(screen.getByRole('listitem')).toHaveTextContent('Demand → Sustainable profit')
      expect(document.body.textContent).not.toContain('rf-secret-edge-id')
      const review = screen.getByRole('button', {
        name: 'Review relationship Demand → Sustainable profit',
      })
      await user.tab()
      expect(review).toHaveFocus()
      await user.keyboard('{Enter}')
      expect(mockOpenEdgeStrengthRecoveryRelationship).toHaveBeenCalledWith(
        'scenario-1',
        'fac_demand',
        'goal_profit',
      )
      expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Restore shared model' })).toBeVisible()

      act(() => { useCanvasStore.setState({ showInspectorPanel: true }) })
      expect(screen.getByTestId('edge-strength-recovery-notice')).toBeVisible()
    })

    it('offers Check/Restore without a dead Review target for a removed relationship', async () => {
      const user = userEvent.setup()
      useCanvasStore.setState({
        currentScenarioId: 'scenario-1',
        edgeStrengthSync: {
          ...EMPTY_EDGE_STRENGTH_SYNC,
          scenarioId: 'scenario-1',
          hydration: 'settled',
          issue: 'unconfirmed_structure',
          recoverySummary: {
            items: [{
              from: 'fac_removed',
              to: 'goal_profit',
              label: 'Former supplier → Sustainable profit',
              kind: 'unconfirmed_structure',
              relationshipExists: false,
            }],
            total: 1,
            remaining: 0,
          },
        },
      } as never)

      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          onCogClick={() => {}}
          recoveryBlockedReason="Former supplier → Sustainable profit was removed only on this device. Check the shared model before running analysis."
        />,
        { wrapper: Wrapper },
      )

      expect(screen.getByText('Former supplier → Sustainable profit')).toBeVisible()
      expect(screen.queryByRole('button', { name: /Review relationship/ })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Check shared model' }))
      expect(mockRefreshEdgeStrengthAuthority).toHaveBeenCalledWith('scenario-1')
      await user.click(screen.getByRole('button', { name: 'Restore shared model' }))
      expect(mockRefreshEdgeStrengthAuthority).toHaveBeenCalledWith(
        'scenario-1',
        { replaceLocalGraph: true },
      )
    })

    it('defensively renders at most three endpoint summaries plus the remainder', () => {
      useCanvasStore.setState({
        currentScenarioId: 'scenario-1',
        edgeStrengthSync: {
          ...EMPTY_EDGE_STRENGTH_SYNC,
          scenarioId: 'scenario-1',
          hydration: 'settled',
          issue: 'unsupported_fields',
          recoverySummary: {
            items: Array.from({ length: 5 }, (_, index) => ({
              from: `source_${index}`,
              to: `target_${index}`,
              label: `Source ${index} → Target ${index}`,
              kind: 'unsupported_fields' as const,
              relationshipExists: index < 2,
            })),
            total: 5,
            remaining: 0,
          },
        },
      } as never)

      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          onCogClick={() => {}}
          recoveryBlockedReason="Relationships need attention before running analysis."
        />,
        { wrapper: Wrapper },
      )

      expect(screen.getAllByRole('listitem')).toHaveLength(3)
      expect(screen.getByText('And 2 more relationships need attention.')).toBeVisible()
      expect(screen.queryByText('Source 3 → Target 3')).not.toBeInTheDocument()
    })

    it('exposes recovery actions for hydration-unconfirmed state without endpoint data', () => {
      useCanvasStore.setState({
        currentScenarioId: 'scenario-1',
        edgeStrengthSync: {
          ...EMPTY_EDGE_STRENGTH_SYNC,
          scenarioId: 'scenario-1',
          hydration: 'unconfirmed',
        },
      } as never)

      render(
        <PersistentInputStrip
          isOlumiTabActive
          onOpenFloating={() => {}}
          onCogClick={() => {}}
          recoveryBlockedReason="Check the shared model before running analysis."
        />,
        { wrapper: Wrapper },
      )

      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Restore shared model' })).toBeVisible()
    })
  })

  describe('composer mode — floating closed', () => {
    it('renders a textarea when floating is closed (composer mode)', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('round-16: strip variant has 3-line min (70px) and 8-line max (160px) so cog+send fit and composer grows', () => {
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
        wrapper: Wrapper,
      })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      // LINE_HEIGHT_PX (18) * STRIP_MIN_LINES (3) + 16 = 70.
      // The cog + send icon stack (28 + 2 + 28 = 58px) now fits inside
      // the textarea border without overflowing.
      expect(textarea.style.minHeight).toBe('70px')
      // LINE_HEIGHT_PX (18) * STRIP_MAX_LINES (8) + 16 = 160.
      // Composer grows as user types; internal scroll engages beyond this.
      expect(textarea.style.maxHeight).toBe('160px')
    })

    it('round-16: strip variant uses larger right inset on icon stack so the scrollbar is not covered when textarea scrolls', () => {
      // When the textarea hits its 160px ceiling and the browser draws
      // an internal vertical scrollbar (≈12px wide), the absolutely-
      // positioned cog + send icon stack would overlap the scrollbar at
      // the default `right-1.5` (6px) inset. Round-16 bumps the strip
      // variant's stackInset to `right-4` (16px) so the icons sit clear
      // of the scrollbar.
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
        wrapper: Wrapper,
      })
      const cog = screen.getByTestId('ai-input-bar-strip-cog')
      const send = screen.getByTestId('ai-input-bar-strip-send')
      // The icon stack is the absolutely-positioned div wrapping both
      // buttons. Both icons share the same parent stack container.
      const stack = cog.parentElement as HTMLElement
      expect(stack).toBe(send.parentElement)
      // Tailwind class assertion — `right-4` corresponds to a 16px inset.
      expect(stack.className).toMatch(/\bright-4\b/)
    })
  })

  describe('status mode — floating open (invariant: no textarea)', () => {
    it('renders status line WITHOUT a textarea when floating is open', () => {
      act(() => {
        useFloatingPanelState.getState().open('user')
      })
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
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
          onCogClick={() => {}}
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
      render(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />, {
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
        <PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />,
        { wrapper: Wrapper },
      )
      expect(screen.getByTestId('persistent-strip-composer')).toBeInTheDocument()
      act(() => {
        useFloatingPanelState.getState().restore()
      })
      rerender(<PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />)
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
          <PersistentInputStrip isOlumiTabActive onOpenFloating={() => {}} onCogClick={() => {}} />
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
