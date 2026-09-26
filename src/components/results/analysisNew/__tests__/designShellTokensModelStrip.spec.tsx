/**
 * ⭐⭐ BUNDLE b1-shell-tokens-model-strip — PROTOTYPE-FIDELITY GAPS, PINNED BY
 * IDENTITY (design-audit-20260925, `bundle-b1-shell-tokens-model-strip.json`).
 *
 * One spec file per bundle, per the audit's method. Each `describe` below
 * pins ONE gap's new presentation against the prototype authority
 * (`Olumi_Reasoning_Prototype_V2.html`) by a testid, a token or a class —
 * never by a size or colour typed twice, so a rename of the underlying
 * token still resolves correctly and a genuine regression still REDs.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { typography } from '../../../../styles/typography'
import { ACTION_TIER } from '../panelSurfaces'
import { WorkspaceShellTabStrip } from '../../../../canvas/components/workspaceShell/WorkspaceShellTabStrip'
import type { WorkspaceSurfaceDescriptor } from '../../../../canvas/components/workspaceShell/shellContract'

// ── ONE shared store mock, ONE mutable state, used by every describe below.
// `ModelStrip` reads `nodes`/`setHighlightedNodes`; `SuccessTargetLine` reads
// `nodes`/`goalThreshold`/`goalThresholdRepresentation`/
// `setGoalThresholdAndUpdateNode`. A single shape avoids the two components
// fighting over which mock of the same module wins.
let mockState: Record<string, unknown> = {}
const setHighlightedNodesSpy = vi.fn()
const setGoalThresholdAndUpdateNode = vi.fn()
vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(mockState)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => mockState
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: false,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget: vi.fn(() => 'dispatched' as const),
    proposeFactorValue: vi.fn(),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))
vi.mock('../useFactorValueCommit', () => ({ useFactorValueCommit: () => ({ commit: vi.fn() }) }))
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { SuccessTargetLine } from '../sections/SuccessTargetLine'
import { ModelReviewTool } from '../sections/ModelReviewTool'

const TID = 'analysis-new-model-strip'
const setNodes = (next: unknown[]) => {
  mockState = { nodes: next, setHighlightedNodes: setHighlightedNodesSpy }
}

afterEach(() => {
  cleanup()
  setHighlightedNodesSpy.mockClear()
  mockState = {}
})

// ─────────────────────────────────────────────────────────────────────────
// gap TYPE-1 / TYPE-2 — the retired token cannot come back, and its
// same-size replacement name must exist for the sibling bundle that needs it.
// ─────────────────────────────────────────────────────────────────────────
describe('gap TYPE-1: reasoningLead is retired, not demoted', () => {
  it('⭐⭐ `typography` no longer declares `reasoningLead`', () => {
    expect(
      Object.prototype.hasOwnProperty.call(typography, 'reasoningLead'),
      'the 18px token must be DELETED — a component reading it by name should fail to compile, not fall back silently',
    ).toBe(false)
  })

  it('⭐ `panelQuestion` (gap TYPE-2) exists, at panelHeader\'s 14px, a different weight', () => {
    expect(typography).toHaveProperty('panelQuestion')
    expect(typography.panelQuestion).toMatch(/text-sm/)
    expect(typography.panelQuestion).toMatch(/font-medium/)
    expect(typography.panelHeader).toMatch(/font-semibold/)
  })

  it('⭐⭐ the -lead element carries panelHeader\'s own class, never a raw text-lg', () => {
    setNodes([
      { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
      { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
      { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
    ])
    render(<ModelStrip isPreRun={false} />)
    const lead = screen.getByTestId(`${TID}-lead`)
    for (const cls of typography.panelHeader.split(' ')) {
      expect(lead.className).toContain(cls)
    }
    expect(lead.className).not.toMatch(/\btext-lg\b/)
  })
})

describe('gap ACTION-2: panelSurfaces declares the text-button tier', () => {
  it('⭐ `text` exists, carries a 24px touch target and no fill', () => {
    expect(ACTION_TIER).toHaveProperty('text')
    expect(ACTION_TIER.text).toContain('min-h-[24px]')
    expect(ACTION_TIER.text).not.toMatch(/bg-primary|bg-info/)
    expect(ACTION_TIER.text).toMatch(/text-info/)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// gap ACTION-1 — the selected dock tab. SUPERSEDED 26 Sep 2026 (see below).
// ─────────────────────────────────────────────────────────────────────────
/**
 * ⚠⚠ THIS PIN WAS REVERSED, AND BOTH AUTHORITIES ARE NAMED SO THE NEXT READER
 * CAN SEE WHY.
 *
 *  - 25 Sep 2026 (#2036, bundle b1): pinned to `Olumi_Reasoning_Prototype_V2.html`
 *    — `.tab[aria-selected="true"]{box-shadow:inset 0 0 0 1px rgb(var(--info-rgb)/.32)}`,
 *    a BORDER, "never a fill or an underline".
 *  - 25 Sep 2026, the LOCKED canvas visual contract
 *    (`olumi-canvas-visual-contract.html`), which owns the right panel's shell:
 *    `.panel-tabs button{font-size:11px;border-bottom:2px solid transparent}`,
 *    `.panel-tabs button.active{border-color:var(--info);color:var(--info);
 *    background:#F3F8FA}` — an UNDERLINE and a TINT.
 *
 * The design audit of 26 Sep (register row #4, served `853feeb7`) measured the
 * outline as the open defect against the contract, and Paul asked on 26 Sep for
 * the latest design prototype to be completed. The panel SHELL follows the
 * canvas contract; the Reasoning prototype still governs the Reasoning tab's
 * own body. Asserted by class token, as before.
 */
describe('gap ACTION-1 (superseded 26 Sep): the selected tab is the contract underline + tint, not an outline', () => {
  const surfaces: WorkspaceSurfaceDescriptor[] = [
    { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
    { id: 'diagnostics', label: 'Model', scroll: 'shell', padding: 'shell', presentedAsTab: true, hiddenReason: '', footerBar: 'reanalyse' },
  ]

  const draw = (activeTab: 'results' | 'diagnostics') =>
    render(
      <WorkspaceShellTabStrip
        surfaces={surfaces}
        activeTab={activeTab}
        onTabClick={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
        expertMode={false}
        onToggleExpertMode={vi.fn()}
        showResultsFreshnessIcon={false}
        resultsStale={false}
        factorsToVerify={0}
      />,
    )

  it('⭐⭐ the ACTIVE tab carries the 2px info underline and the contract tint, and no outline', () => {
    draw('results')
    const tab = screen.getByTestId('outputs-dock-tab-results')
    expect(tab.className).toMatch(/(^|\s)border-b-2(\s|$)/)
    expect(tab.className).toMatch(/(^|\s)border-info(\s|$)/)
    expect(tab.className).toContain('bg-[var(--panel-tab-active-bg)]')
    expect(tab.className).not.toMatch(/border-info\/80/)
  })

  it('⭐ the IDLE tab carries the transparent underline scaffold and no tint', () => {
    draw('results')
    const idle = screen.getByTestId('outputs-dock-tab-diagnostics')
    expect(idle.className).toMatch(/(^|\s)border-b-2(\s|$)/)
    expect(idle.className).toMatch(/border-transparent/)
    expect(idle.className).not.toContain('bg-[var(--panel-tab-active-bg)]')
  })

  it('CONTRAST: switching the active tab moves the underline and the tint', () => {
    draw('diagnostics')
    const active = screen.getByTestId('outputs-dock-tab-diagnostics')
    const idle = screen.getByTestId('outputs-dock-tab-results')
    expect(active.className).toContain('bg-[var(--panel-tab-active-bg)]')
    expect(idle.className).not.toContain('bg-[var(--panel-tab-active-bg)]')
    expect(idle.className).toMatch(/border-transparent/)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// gap FIRST-3 — the decision line is not restated when it already carries
// the goal's words.
// ─────────────────────────────────────────────────────────────────────────
describe('gap FIRST-3: the decision line is not restated when it already carries the goal', () => {
  /**
   * ⚠⚠ AMENDED (wave 2, design-audit-20260925): THIS ASSERTED THE PREFIX,
   * WHICH WAS ITSELF THE DEFECT (H1). CEE's decision label is a field name
   * wearing a sentence's clothes — `'Decision: <goal label>'` — and Paul's
   * own manual test named exactly this string on screen as the bug. Wave 1
   * closed the RESTATEMENT (one line, not two); wave 2 closes the PREFIX, so
   * the surviving line reads as the question the model is about, not as the
   * producer's field name. See `stripDecisionPrefix` in `ModelStrip.tsx`.
   */
  it('⭐⭐ "Decision: Delivery velocity" + goal "Delivery velocity" → ONE line, not two, prefix stripped', () => {
    setNodes([
      { id: 'd1', type: 'decision', data: { label: 'Decision: Delivery velocity' } },
      { id: 'g1', type: 'goal', data: { label: 'Delivery velocity' } },
      { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
    ])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent('Delivery velocity')
    expect(screen.getByTestId(`${TID}-lead`)).not.toHaveTextContent('Decision:')
    expect(
      screen.queryByTestId(`${TID}-goal`),
      'the goal\'s words already sit inside the decision line',
    ).toBeNull()
  })

  it('⭐ CONTRAST: a genuinely distinct goal still gets its own line', () => {
    setNodes([
      { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
      { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
      { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
    ])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-goal`)).toHaveTextContent('Sustained margin')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// gap NARROW-2 — the disclosure chevron never reserves an inline column
// beside the subject.
// ─────────────────────────────────────────────────────────────────────────
describe('gap NARROW-2: the disclosure chevron never reserves an inline column beside the subject', () => {
  /**
   * ⚠⚠ AMENDED (wave 2, design-audit-20260925, H1): THE CHEVRON ITSELF IS
   * GONE, NOT REPOSITIONED. The design authority's title row
   * (`Olumi_Reasoning_Prototype_V2.html`'s `.briefrow h2`) carries no
   * disclosure glyph at all — the census beneath it is not something the
   * title promises to expand. Wave 1 fixed WHERE a chevron sat (absolute, so
   * it could not steal the subject's line-wrap budget); wave 2 removes it,
   * because Paul's own report named it directly ("...and a chevron"). The
   * toggle affordance is NOT removed: the whole header stays one button, so
   * the title itself remains how a reader opens or closes the marks region —
   * this file's `aria-expanded` case, run separately, already covers that.
   */
  it('⭐⭐ no chevron renders in the title row — the toggle stays reachable by clicking the title itself', () => {
    setNodes([
      { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
      { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
    ])
    render(<ModelStrip isPreRun={false} />)
    const toggle = screen.getByTestId(`${TID}-toggle`)
    const chevron = toggle.querySelector(':scope > svg[aria-hidden="true"]')
    expect(chevron, 'the prototype title carries no disclosure glyph').toBeNull()
    // The affordance survives: the whole header is still one clickable
    // button that flips `aria-expanded`.
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// gap SPACE-2 / FIRST-2 — the review row draws no rule of its own.
// ─────────────────────────────────────────────────────────────────────────
describe('gap SPACE-2: the review row draws no rule of its own', () => {
  it('⭐⭐ ModelReviewTool\'s root carries no border-b / border-panel-border', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    const root = screen.getByTestId('analysis-new-review')
    expect(root.className).not.toMatch(/border-b\b/)
    expect(root.className).not.toMatch(/border-panel-border/)
    expect(root.className).toMatch(/!mt-1/)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// gap SPACE-4 / NARROW-8 — SuccessTargetLine draws its own rule only when
// asked; the model strip's usage asks it not to.
// ─────────────────────────────────────────────────────────────────────────
describe('gap SPACE-4 / NARROW-8: SuccessTargetLine draws its own rule only when asked', () => {
  const goalState = () => ({
    nodes: [{ id: 'g1', type: 'goal', data: {} }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode,
  })

  it('⭐⭐ default (GoalPanel\'s usage): the border-t rule renders', () => {
    mockState = goalState()
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="target" />)
    expect(screen.getByTestId('target').className).toMatch(/border-t/)
  })

  it('⭐⭐ `divider={false}` (ModelStrip\'s usage): no border-t rule', () => {
    mockState = goalState()
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="target" divider={false} />)
    expect(screen.getByTestId('target').className).not.toMatch(/border-t/)
  })

  it('⭐ the strip itself renders its SuccessTargetLine with divider={false}', () => {
    setNodes([
      { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
      { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
    ])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-target`).className).not.toMatch(/border-t/)
  })
})
