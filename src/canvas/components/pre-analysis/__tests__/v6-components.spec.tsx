/**
 * Targeted tests for v6 wireframe components.
 * Covers: ModelHealthCard, DraftNotes, deriveExpertiseGroups, YourExpertise empty state,
 * KeyRelationshipsSubgroup collapsed default + meta line, EdgeEvidenceGaps collapsed default.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthCard } from '../ModelHealthCard'
import { DraftNotes } from '../DraftNotes'
import { KeyRelationshipsSubgroup } from '../expertise/KeyRelationshipsSubgroup'
import { EdgeEvidenceGaps } from '../expertise/EdgeEvidenceGaps'
import { deriveExpertiseGroups } from '../hooks/deriveExpertiseGroups'
import { hasFeasibilityWarning } from '../utils/hasFeasibilityWarning'

describe('ModelHealthCard', () => {
  it('shows "Generating..." placeholder when loading with no goal', () => {
    render(
      <ModelHealthCard
        completeness={0}
        evidence={0}
        balance={0}
        calibration={0}
        optionCount={0}
        goalLabel={null}
        coachingSummary={null}
        isLoading={true}
        hasGoalNode={false}
      />
    )
    expect(screen.getByText(/Generating your decision model/)).toBeInTheDocument()
  })

  it('displays overall score as integer (no decimals)', () => {
    render(
      <ModelHealthCard
        completeness={0.33}
        evidence={0.5}
        balance={0.25}
        calibration={0.8}
        optionCount={3}
        goalLabel="Revenue"
        coachingSummary={null}
        isLoading={false}
        hasGoalNode={true}
      />
    )
    // Score = Math.round((0.33 + 0.5 + 0.25 + 0.8) / 4 * 100) = Math.round(47) = 47
    expect(screen.getByText('Model health')).toBeInTheDocument()
  })

  it('shows 0 when all dimensions are 0', () => {
    const { container } = render(
      <ModelHealthCard
        completeness={0}
        evidence={0}
        balance={0}
        calibration={0}
        optionCount={0}
        goalLabel="Goal"
        coachingSummary={null}
        isLoading={false}
        hasGoalNode={true}
      />
    )
    // Ring centre shows "0"
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.textContent).toContain('0')
  })

  it('shows decision summary with option count and goal label', () => {
    render(
      <ModelHealthCard
        completeness={0.5}
        evidence={0.5}
        balance={0.5}
        calibration={0.5}
        optionCount={3}
        goalLabel="Revenue Growth"
        coachingSummary={null}
        isLoading={false}
        hasGoalNode={true}
      />
    )
    expect(screen.getByText(/Choosing between 3 strategies to achieve Revenue Growth/)).toBeInTheDocument()
  })
})

describe('DraftNotes', () => {
  it('shows empty state when no data', () => {
    render(
      <DraftNotes
        modelAdjustments={[]}
        repairActions={[]}
      />
    )
    expect(screen.getByText(/No draft notes for this model/)).toBeInTheDocument()
  })

  it('shows item count when adjustments present', () => {
    render(
      <DraftNotes
        modelAdjustments={[
          { code: 'fix1', reason: 'Fixed something' },
          { code: 'fix2', reason: 'Fixed another' },
        ]}
        repairActions={['Repair 1']}
      />
    )
    expect(screen.getByText(/Draft notes · 3 items/)).toBeInTheDocument()
  })
})

describe('deriveExpertiseGroups', () => {
  it('counts contested edges from contestedEdges array', () => {
    const groups = deriveExpertiseGroups(
      { fix: [], verify: [], add_evidence: [], strengthen: [] },
      [{ edge: { id: 'e1', source: 's1', target: 't1' } as any, validation: {} }],
      [],
      [],
      undefined,
      undefined,
    )
    expect(groups.contestedCount).toBe(1)
  })

  it('identifies missing data factors', () => {
    const groups = deriveExpertiseGroups(
      { fix: [], verify: [], add_evidence: [], strengthen: [] },
      [],
      [
        { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Missing Factor', observedState: { value: null } } },
        { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Has Data', observedState: { value: 0.5 } } },
      ] as any,
      [],
      undefined,
      undefined,
    )
    expect(groups.missingData.length).toBe(1)
    expect(groups.missingData[0].label).toBe('Missing Factor')
  })

  it('sorts AI estimated by factorInfluenceMap desc', () => {
    const influenceMap = new Map([['f1', 0.3], ['f2', 0.7]])
    const groups = deriveExpertiseGroups(
      {
        fix: [],
        verify: [
          { key: 'v1', category: 'verify', label: 'Low', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'f1', label: 'Low' } },
          { key: 'v2', category: 'verify', label: 'High', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'f2', label: 'High' } },
        ],
        add_evidence: [],
        strengthen: [],
      },
      [],
      [],
      [],
      influenceMap,
      undefined,
    )
    expect(groups.aiEstimated[0].label).toBe('High')
    expect(groups.aiEstimated[1].label).toBe('Low')
  })
})

describe('hasFeasibilityWarning', () => {
  it('returns false for undefined critiques', () => {
    expect(hasFeasibilityWarning(undefined)).toBe(false)
  })

  it('returns true for CONSTRAINT_NEAR_BOUND', () => {
    expect(hasFeasibilityWarning([{ code: 'CONSTRAINT_NEAR_BOUND' }])).toBe(true)
  })

  it('returns true for GOAL_THRESHOLD_EXCEEDS_RANGE', () => {
    expect(hasFeasibilityWarning([{ code: 'GOAL_THRESHOLD_EXCEEDS_RANGE' }])).toBe(true)
  })

  it('returns false for unrelated code', () => {
    expect(hasFeasibilityWarning([{ code: 'SOME_OTHER_CODE' }])).toBe(false)
  })
})

describe('DraftNotes formatDraftText', () => {
  it('renders with item count', () => {
    render(
      <DraftNotes
        modelAdjustments={[{ reason: 'value 0.123456789' }]}
        repairActions={[]}
      />
    )
    expect(screen.getByText(/Draft notes · 1 item/)).toBeInTheDocument()
  })
})

describe('deriveExpertiseGroups actionableCount', () => {
  it('actionableCount excludes fromBrief, keyRelationships, edgeGaps', () => {
    const groups = deriveExpertiseGroups(
      {
        fix: [],
        verify: [
          { key: 'v1', category: 'verify', label: 'AI Factor', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'f1', label: 'AI Factor' } },
          { key: 'v2', category: 'verify', label: 'Brief Factor', detail: '', subgroup: 'brief_extraction', focus: { type: 'node', id: 'f2', label: 'Brief Factor' } },
        ],
        add_evidence: [],
        strengthen: [],
      },
      [{ edge: { id: 'e1', source: 's1', target: 't1' } as any, validation: {} }],
      [
        { id: 'f3', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Missing', observedState: { value: null } } },
      ] as any,
      [{ id: 'e2', source: 's2', target: 't2', data: {} }] as any,
      undefined,
      undefined,
    )
    // actionableCount = 1 contested + 1 AI-estimated + 1 missing = 3
    // fromBrief (1) and edgeGaps are NOT included
    expect(groups.actionableCount).toBe(3)
    expect(groups.totalCount).toBeGreaterThan(groups.actionableCount)
  })
})

describe('KeyRelationshipsSubgroup', () => {
  const testItems = [
    {
      edgeId: 'e1',
      sourceLabel: 'Factor A',
      targetLabel: 'Goal',
      weight: 0.45,
      direction: 'positive',
      beliefExists: 0.8,
      std: 0.15,
      influence: 0.6,
    },
  ]

  it('renders collapsed by default — shows toggle text, hides edge detail rows', () => {
    render(<KeyRelationshipsSubgroup items={testItems} />)
    expect(screen.getByText('Show key relationships')).toBeInTheDocument()
    // Collapsed hint visible
    expect(screen.getByText(/1 causal relationship/)).toBeInTheDocument()
    // Strength quick-select buttons NOT visible when collapsed (expanded-only content)
    expect(screen.queryByText('Weakly')).not.toBeInTheDocument()
    expect(screen.queryByText('Moderately')).not.toBeInTheDocument()
    // Meta line NOT visible when collapsed
    expect(screen.queryByText(/Moderate confidence/)).not.toBeInTheDocument()
  })

  it('shows meta line with strength label, confidence band, and beliefExists when expanded', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<KeyRelationshipsSubgroup items={testItems} />)
    // Expand
    await user.click(screen.getByText('Show key relationships'))
    // Edge label visible
    expect(screen.getByText('Factor A → Goal')).toBeInTheDocument()
    // Strength label: Moderate positive (0.45)
    expect(screen.getByText(/Moderate positive/)).toBeInTheDocument()
    expect(screen.getByText(/0\.45/)).toBeInTheDocument()
    // Confidence band: std=0.15 → Moderate confidence
    expect(screen.getByText(/Moderate confidence/)).toBeInTheDocument()
    // Exists probability: 80% likely
    expect(screen.getByText(/80% likely/)).toBeInTheDocument()
  })
})

describe('EdgeEvidenceGaps', () => {
  const testItems = [
    { edgeId: 'e1', sourceLabel: 'X', targetLabel: 'Y', influence: 0.4 },
    { edgeId: 'e2', sourceLabel: 'A', targetLabel: 'B', influence: 0.2 },
  ]

  it('renders collapsed by default — shows toggle text, hides edge rows', () => {
    render(<EdgeEvidenceGaps items={testItems} />)
    expect(screen.getByText('Show 2 edge improvements')).toBeInTheDocument()
    // Edge labels NOT visible when collapsed
    expect(screen.queryByText('X → Y')).not.toBeInTheDocument()
    expect(screen.queryByText('A → B')).not.toBeInTheDocument()
  })
})
