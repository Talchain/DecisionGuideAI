/**
 * Inspector completion — L-38 (internal/engineering vocabulary), inspector half.
 *
 * RED-first. Three instances on the S01 relationship inspector:
 *
 *   a. `contested_reasons` rendered as RAW ENUM TOKENS
 *      ("existence_boundary_crossing") via a bare `.join(', ')`.
 *   b. `pass2.basis` rendered as a RAW ENUM TOKEN ("domain_prior").
 *   c. "Pass 1 (current) / Pass 2 (review)" stat blocks — Strength / Std /
 *      Exists — presented at rest as the primary explanation.
 *
 * The estate already owns the translation and the good copy precedent (S18):
 * `getContestedReasonLabel` / `getBasisLabel` in model-tab/strengthBands.ts.
 * The inspector must consume THOSE, not re-mint a second vocabulary — a
 * hand-copied twin is how the same enum came to have two labels before.
 *
 * Acceptance: no raw enum tokens AT REST. The numbers survive, behind a
 * progressive-disclosure detail, in user language.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import {
  getContestedReasonLabel,
  getBasisLabel,
} from '../../../components/model-tab/strengthBands'

const panelProps = {
  edgeId: 'e1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

const contestedValidation = {
  status: 'contested',
  contested_reasons: ['existence_boundary_crossing', 'sign_flip'],
  pass1: { strength_mean: 0.35, strength_std: 0.15, exists_probability: 0.82 },
  pass2: {
    strength_mean: 0.62,
    strength_std: 0.2,
    exists_probability: 0.7,
    reasoning: 'Second pass read the brief as a stronger link.',
    basis: 'domain_prior',
    needs_user_input: true,
  },
  max_divergence: 0.27,
  distance_to_goal: 1,
  evoi_rank: null,
  evoi_impact: null,
  surfaced: true,
  was_shown: false,
  user_action: 'pending',
  resolved_value: null,
  resolved_by: 'default',
}

function setContestedStore(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'fac1',
        target: 'out1',
        data: {
          weight: 0.35,
          direction: 'positive',
          beliefExists: 0.82,
          strengthStd: 0.15,
          validation: contestedValidation,
        },
      },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.setState({
    guidanceItems: [],
    _prefillChat: null,
    _sendMessage: null,
    _dispatchAction: null,
  } as never)
})

describe('L-38 · the contested-edge surface renders no raw enum tokens at rest', () => {
  it('renders the Evidence group for this fixture (precondition — pinned in-test)', () => {
    // Without this the absence assertions below could pass on a panel that
    // never rendered the surface under test at all.
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="evidence"]')).not.toBeNull()
  })

  it('does not print the raw contested-reason tokens', () => {
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.textContent).not.toContain('existence_boundary_crossing')
    expect(container.textContent).not.toContain('sign_flip')
  })

  it('does not print the raw basis token', () => {
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.textContent).not.toContain('domain_prior')
  })

  it('does not print the "Pass 1 / Pass 2" engineering headings at rest', () => {
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.textContent).not.toContain('Pass 1 (current)')
    expect(container.textContent).not.toContain('Pass 2 (review)')
    expect(container.textContent).not.toContain('Std:')
  })
})

describe('L-38 · it says the same thing in the S18 vocabulary instead', () => {
  it('uses the SHARED translator for every reason (not a second hand-written map)', () => {
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    for (const reason of ['existence_boundary_crossing', 'sign_flip'] as const) {
      expect(container.textContent).toContain(getContestedReasonLabel(reason))
    }
  })

  it('uses the SHARED translator for the basis', () => {
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.textContent).toContain(getBasisLabel('domain_prior'))
  })

  it('keeps the reviewer reasoning quote, which was already user language', () => {
    setContestedStore()
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText(/Second pass read the brief as a stronger link/)).toBeTruthy()
  })
})

describe('L-38 · the numbers survive behind progressive disclosure, in user language', () => {
  it('offers a detail control rather than deleting the comparison', () => {
    setContestedStore()
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-review-detail')).toBeTruthy()
  })

  it('reveals both estimates under user-language headings when opened', () => {
    setContestedStore()
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('edge-review-detail-toggle'))
    const detail = screen.getByTestId('edge-review-detail')
    // Both numbers, both named for what they mean to the reader.
    expect(detail.textContent).toContain('0.35')
    expect(detail.textContent).toContain('0.62')
    expect(detail.textContent).toMatch(/currently uses/i)
    expect(detail.textContent).toMatch(/review suggested/i)
    // Still no engineering tokens once opened.
    expect(detail.textContent).not.toContain('Std:')
    expect(detail.textContent).not.toContain('pass1')
    expect(detail.textContent).not.toContain('pass2')
  })

  it('keeps the raw tokens available to expert mode only', () => {
    // Discriminating twin: the tokens are not deleted from the product, they
    // are moved behind the technical disclosure. Proves the at-rest absence
    // above is a placement fix, not a data loss.
    setContestedStore()
    const { container } = render(<EdgePanel {...panelProps} techMode={true} />)
    expect(container.textContent).toContain('existence_boundary_crossing')
  })
})
