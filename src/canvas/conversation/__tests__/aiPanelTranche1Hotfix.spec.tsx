/**
 * Tranche 1 hotfix regression suite — covers the five items landed in the
 * hotfix brief:
 *   3  Run analysis is icon-only (no visible text label)
 *   4  Run analysis disables while PLoT analysis is in flight
 *   6  describeOperation fallback uses element type from id prefix
 *   7  safeRichText emits md-gap before any bold-lead paragraph
 *   9  GraphPatchBlock label fallback — "Update option" not "Update factor"
 *
 * Item 6 (Thinking… sentinel suppression) is a delete-only change in
 * useConversation.ts; covered by MessageBubble.streaming.spec.tsx's existing
 * "does not show tool loading when toolLoadingState is null" case. No new
 * test is added here because the deleted code path is no longer reachable.
 */

import { describe, it, expect } from 'vitest'
import { safeRichText } from '../../utils/safeRichText'
import { describeOperation, RAW_ID_PATTERN } from '../friendlyOperation'
import type { PatchOperation } from '../types'

// ---------------------------------------------------------------------------
// Item 3 — Run analysis is icon-only
// ---------------------------------------------------------------------------

describe('Hotfix item 3 — Run analysis is icon-only', () => {
  it('ChatComposer source no longer renders a "Run analysis" span label', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../zones/ChatComposer.tsx'),
      'utf8',
    )
    // The icon + testid still exist…
    expect(src).toMatch(/data-testid="run-analysis-chip"/)
    expect(src).toMatch(/<Play /)
    // …but no <span>Run analysis</span> label inside the button.
    expect(src).not.toMatch(/<span>Run analysis<\/span>/)
    // aria-label still announces the affordance for screen readers.
    expect(src).toMatch(/aria-label=\{.*'Run analysis'/)
  })
})

// ---------------------------------------------------------------------------
// Item 4 — Run analysis disables while in-flight
// ---------------------------------------------------------------------------

describe('Hotfix item 4 — Run analysis gate combines readiness + in-flight', () => {
  it('ConversationPanel threads useV2Run isRunning into canRunAnalysis', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../ConversationPanel.tsx'),
      'utf8',
    )
    // useV2Run exposes isRunning, aliased to isV2RunInFlight.
    expect(src).toMatch(/isRunning:\s*isV2RunInFlight/)
    // The button gate combines structural readiness with the in-flight flag,
    // closing the click-to-statusFlip gap that could allow a double-fire.
    expect(src).toMatch(/canRunAnalysis=\{runGateResult\.allowed\s*&&\s*!isV2RunInFlight\}/)
  })
})

// ---------------------------------------------------------------------------
// Item 7 — safeRichText bold-lead vertical rhythm
// ---------------------------------------------------------------------------

describe('Hotfix item 7 — safeRichText emits md-gap around bold-lead paragraphs', () => {
  it('emits md-gap between a bold-lead header and the following body text', () => {
    const input = '**Section header**\nBody paragraph that follows the header.'
    const html = safeRichText(input)
    // The transition from **header** to body now renders with visible spacing.
    expect(html).toContain('<br class="md-gap">')
    // And it sits between the strong tag and the body text.
    expect(html).toMatch(/<strong>Section header<\/strong><br class="md-gap">Body paragraph/)
  })

  it('emits md-gap before a bold-lead paragraph that follows body text', () => {
    const input = 'Some body text.\n**Next section**'
    const html = safeRichText(input)
    expect(html).toMatch(/Some body text\.<br class="md-gap"><strong>Next section<\/strong>/)
  })

  it('still emits md-gap between two consecutive bold-lead paragraphs', () => {
    const input = '**Header A**\n**Header B**'
    const html = safeRichText(input)
    expect(html).toMatch(/<strong>Header A<\/strong><br class="md-gap"><strong>Header B<\/strong>/)
  })

  it('uses plain <br> between two non-bold paragraphs with no blank separator', () => {
    const input = 'First sentence.\nSecond sentence.'
    const html = safeRichText(input)
    // No md-gap injection when neither side is bold-lead.
    expect(html).not.toContain('<br class="md-gap">')
    expect(html).toContain('<br>')
  })

  it('still emits md-gap around explicit blank-line paragraph breaks', () => {
    const input = 'Paragraph one.\n\nParagraph two.'
    const html = safeRichText(input)
    expect(html).toContain('<br class="md-gap">')
  })
})

// ---------------------------------------------------------------------------
// Item 9 — GraphPatchBlock label fallback uses element-type word
// ---------------------------------------------------------------------------

describe('Hotfix item 9 — describeOperation fallback uses element type from id prefix', () => {
  const emptyDeps = { nodeLabels: new Map(), edgeEndpoints: new Map() }

  it('update_node on an option id returns "Update option"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'opt_expand_market', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update option')
  })

  it('remove_node on a goal id returns "Remove goal"', () => {
    const op: PatchOperation = { op: 'remove_node', target_id: 'goal_reach_20k_mrr', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Remove goal')
  })

  it('update_node on a decision id returns "Update decision"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'decision_rebuild_checkout', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update decision')
  })

  it('add_node on an outcome id returns "Add outcome"', () => {
    const op: PatchOperation = { op: 'add_node', target_id: 'outcome_churn_below_4pct', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Add outcome')
  })

  it('update_node on a constraint id returns "Update constraint"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'con_budget_cap', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update constraint')
  })

  it('update_node on a factor id returns "Update factor"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'fac_team_morale', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update factor')
  })

  it('update_node on an unrecognised id falls back to "Update factor"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'weird_xyz', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update factor')
  })

  it('edge operations still return "… connection" regardless of id shape', () => {
    const ops: Array<[PatchOperation['op'], string]> = [
      ['add_edge', 'Add connection'],
      ['update_edge', 'Update connection'],
      ['remove_edge', 'Remove connection'],
    ]
    for (const [opName, expected] of ops) {
      const op: PatchOperation = { op: opName, target_id: 'edge_ghost_1', data: {} }
      expect(describeOperation(op, emptyDeps)).toBe(expected)
    }
  })

  it('security invariant: fallback never contains the raw target_id', () => {
    const ids = [
      'opt_expand_market',
      'goal_reach_20k_mrr',
      'factor_team_morale',
      'option_hire_tech_lead',
      'decision_rebuild_checkout',
      'outcome_happy_user',
      'constraint_budget_cap',
    ]
    for (const id of ids) {
      const op: PatchOperation = { op: 'update_node', target_id: id, data: {} }
      const result = describeOperation(op, emptyDeps)
      expect(result).not.toMatch(RAW_ID_PATTERN)
      expect(result).not.toContain(id)
    }
  })
})
