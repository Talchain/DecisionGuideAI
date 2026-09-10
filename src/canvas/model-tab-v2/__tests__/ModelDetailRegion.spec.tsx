/**
 * Model tab v2 — THE DETAIL REGION (design §4.4).
 *
 * Two properties carry this file:
 *   · the Advanced block is ABSENT FROM THE DOM in Plain, not merely invisible;
 *   · the region REFUSES to render another element's detail.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelDetailRegion } from '../ModelDetailRegion'
import type { ModelRow, ModelRowDetail } from '../types'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'

const ROW: ModelRow = {
  id: 'f1',
  kind: 'factor',
  group: 'factors',
  label: 'Sales cycle length',
  primaryValue: '45 days',
  provenanceSource: 'cee_inference',
  attention: [],
  editable: true,
}

function detail(over: Partial<ModelRowDetail> = {}): ModelRowDetail {
  return {
    rowId: 'f1',
    // Most rows are not in this state: the producer either gave a figure or
    // nobody has looked. `true` is the deliberate, rarer case.
    priorIsExplicitlyUnquantified: false,
    description: 'How long a deal takes to close.',
    secondaryValues: [{ label: 'Baseline', value: '50 days' }],
    basis: 'Inferred from model structure',
    adjustments: [],
    affects: [],
    // A FACTOR has none. Interventions belong to options, so the honest default
    // here is the empty list, not an omission — `ModelRowDetail` requires the
    // field precisely so a producer cannot forget it.
    interventions: [],
    advancedParameters: [
      { label: 'Elasticity', value: '0.42' },
      { label: 'Node ID', value: 'f1' },
    ],
    ...over,
  }
}

describe('⭐ ModelDetailRegion — Advanced is ABSENT in Plain, not hidden', () => {
  it('does not render the Advanced block at all in Plain', () => {
    render(<ModelDetailRegion row={ROW} detail={detail()} tier="plain" />)
    expect(screen.queryByTestId('model-detail-v2-advanced')).toBeNull()
  })

  it('does not leak a single advanced PARAMETER into the Plain DOM', () => {
    render(<ModelDetailRegion row={ROW} detail={detail()} tier="plain" />)
    // Absence of the container is not absence of its contents — a parameter
    // rendered anywhere else in Plain would breach §4.3 rule 2 (never mixed
    // inline) while leaving the assertion above perfectly green.
    expect(screen.queryByText('Elasticity')).toBeNull()
    expect(screen.queryByText('0.42')).toBeNull()
  })

  it('POSITIVE CONTROL: the four plain sections DO render in Plain', () => {
    // Without this, the two absences above would also pass on a component that
    // rendered nothing at all (trap 13).
    render(<ModelDetailRegion row={ROW} detail={detail()} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-what')).toBeInTheDocument()
    expect(screen.getByTestId('model-detail-v2-value')).toBeInTheDocument()
    expect(screen.getByTestId('model-detail-v2-provenance')).toBeInTheDocument()
    expect(screen.getByTestId('model-detail-v2-affects')).toBeInTheDocument()
  })

  it('renders the Advanced block, with its parameters, in Advanced', () => {
    render(<ModelDetailRegion row={ROW} detail={detail()} tier="advanced" />)
    expect(screen.getByTestId('model-detail-v2-advanced')).toBeInTheDocument()
    expect(screen.getByTestId('model-detail-v2-advanced-fields-Elasticity')).toHaveTextContent('0.42')
  })

  it('flipping to Advanced adds ONLY the Advanced block — the plain sections are untouched', () => {
    const { rerender } = render(<ModelDetailRegion row={ROW} detail={detail()} tier="plain" />)
    const plainWhat = screen.getByTestId('model-detail-v2-what').textContent
    const plainValue = screen.getByTestId('model-detail-v2-value').textContent

    rerender(<ModelDetailRegion row={ROW} detail={detail()} tier="advanced" />)
    expect(screen.getByTestId('model-detail-v2-what').textContent).toBe(plainWhat)
    expect(screen.getByTestId('model-detail-v2-value').textContent).toBe(plainValue)
  })

  it('says so when an element genuinely has no parameters, rather than showing an empty block', () => {
    render(
      <ModelDetailRegion row={ROW} detail={detail({ advancedParameters: [] })} tier="advanced" />,
    )
    expect(screen.getByTestId('model-detail-v2-advanced')).toHaveTextContent(
      'This element has no model parameters',
    )
  })
})

describe('⭐ ModelDetailRegion — it refuses to show another element\'s detail', () => {
  it('renders a stated refusal when the detail belongs to a different row', () => {
    render(<ModelDetailRegion row={ROW} detail={detail({ rowId: 'f2' })} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-mismatch')).toBeInTheDocument()
    expect(screen.getByTestId('model-detail-v2')).toHaveAttribute('data-mismatch', 'true')
  })

  it('shows NONE of the mismatched content — not the description, not the parameters', () => {
    render(
      <ModelDetailRegion
        row={ROW}
        detail={detail({ rowId: 'f2', description: 'Belongs to a different factor' })}
        tier="advanced"
      />,
    )
    expect(screen.queryByText('Belongs to a different factor')).toBeNull()
    expect(screen.queryByTestId('model-detail-v2-advanced')).toBeNull()
  })

  it('POSITIVE CONTROL: the same detail renders fully when the ids DO match', () => {
    // Proves the refusal above is the id gate biting, and not a component that
    // fails to render this fixture for some unrelated reason.
    render(<ModelDetailRegion row={ROW} detail={detail({ rowId: 'f1' })} tier="plain" />)
    expect(screen.queryByTestId('model-detail-v2-mismatch')).toBeNull()
    expect(screen.getByTestId('model-detail-v2-description')).toBeInTheDocument()
  })
})

describe('ModelDetailRegion — absence is rendered as absence', () => {
  it('omits the description entirely when there is none', () => {
    render(<ModelDetailRegion row={ROW} detail={detail({ description: null })} tier="plain" />)
    expect(screen.queryByTestId('model-detail-v2-description')).toBeNull()
  })

  it('renders "Not stated" for a null field rather than a blank or a zero', () => {
    render(
      <ModelDetailRegion
        row={ROW}
        detail={detail({ secondaryValues: [{ label: 'Baseline', value: null }] })}
        tier="plain"
      />,
    )
    expect(screen.getByTestId('model-detail-v2-secondary-Baseline')).toHaveTextContent('Not stated')
  })

  it('renders "Not set" for a row with no primary value', () => {
    render(
      <ModelDetailRegion row={{ ...ROW, primaryValue: null }} detail={detail()} tier="plain" />,
    )
    expect(screen.getByTestId('model-detail-v2-primary')).toHaveTextContent('Not set')
  })

  it('says nothing depends on this element rather than showing an empty list', () => {
    render(<ModelDetailRegion row={ROW} detail={detail({ affects: [] })} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-affects')).toHaveTextContent(
      'Nothing in the model depends on this yet',
    )
  })
})

describe('ModelDetailRegion — navigation is ID-addressed', () => {
  it('reports the id of the affected element that was clicked, not its label or index', () => {
    const onFocusOnCanvas = vi.fn()
    render(
      <ModelDetailRegion
        row={ROW}
        detail={detail({
          affects: [
            { id: 'e1', label: 'Same label' },
            { id: 'e2', label: 'Same label' },
          ],
        })}
        tier="plain"
        onFocusOnCanvas={onFocusOnCanvas}
      />,
    )
    // Two entries share a label deliberately: a lookup by text could not tell
    // them apart, so this pins the binding to the id.
    fireEvent.click(screen.getByTestId('model-detail-v2-affects-e2'))
    expect(onFocusOnCanvas).toHaveBeenCalledWith('e2')
  })
})

/**
 * ⭐⭐ THE SURVIVING PROVENANCE STATEMENT, PINNED.
 *
 * ⚠⚠ WHY THIS EXISTS. `#1352` removed one of the pane's TWO statements of where
 * a value came from, leaving `SourceProvenancePill` as the only one. Review then
 * neutered that pill (`source={undefined}`) and ran the whole surface: **38 test
 * files / 496 tests, all green.** Before the PR, deleting the pill still left
 * `basis` printing "Source: AI estimate"; after it, the pane could state
 * provenance ZERO times with nothing anywhere going red. `model-detail-v2-basis`
 * had one occurrence in `src` and zero spec references (contrast control:
 * `model-detail-v2-primary` resolves in 2 files, so the sweep does see spec
 * references).
 *
 * The PR asserted the ABSENCE of the duplicate and never the PRESENCE of the
 * survivor. Removing a duplicate is only safe if something pins the original.
 *
 * ⚠ `toBe(1)`, NEVER `toBeLessThanOrEqual(1)` — the second passes when the
 * producer is gone, which is the exact failure this case is for. The label is
 * imported from `VALUE_PROVENANCE_LABEL` rather than typed as a literal, so a
 * rename moves the assertion with the product instead of silently missing it.
 *
 * ⚠ `textContent` does not include attribute values, so the pill's
 * `title="Source: cee_inference"` cannot inflate the count; and the pill renders
 * exactly one text node with no `sr-only` sibling, which `innerText` would have
 * folded in.
 */
describe('⭐⭐ the pane states provenance exactly once — and the survivor is pinned', () => {
  const AI_LABEL = VALUE_PROVENANCE_LABEL.ai

  const provenanceCount = (section: HTMLElement) =>
    (section.textContent ?? '').split(AI_LABEL).length - 1

  it('⭐⭐ says it EXACTLY ONCE when only the pill carries it', () => {
    render(<ModelDetailRegion row={ROW} detail={detail({ basis: null })} tier="plain" />)
    const section = screen.getByTestId('model-detail-v2-provenance')
    // Neuter the pill (`source={undefined}`) and this reads 0 and REDs — the
    // mutant that survived 496 tests before this case existed.
    expect(provenanceCount(section)).toBe(1)
  })

  /**
   * ⚠ THE DISCRIMINATION CONTROL. Without it, `toBe(1)` above could be passing
   * on a counter that cannot read anything other than 1 — and a counter that
   * cannot reach 2 could never have caught the duplication this PR removed.
   * Here the duplicate is put back deliberately and the count must say 2.
   */
  it('CONTROL: the counter CAN read two — so the "exactly once" above discriminates', () => {
    render(
      <ModelDetailRegion row={ROW} detail={detail({ basis: `Source: ${AI_LABEL}` })} tier="plain" />,
    )
    expect(provenanceCount(screen.getByTestId('model-detail-v2-provenance'))).toBe(2)
  })

  /**
   * ⚠ AND ZERO IS A LEGITIMATE ANSWER WHEN THE PRODUCER STAMPED NOTHING — the
   * section must then not render at all, rather than render an empty heading.
   * This is what stops the two cases above being read as "always say it once".
   */
  it('CONTROL: with no source and no basis, the section does not render', () => {
    render(
      <ModelDetailRegion
        row={{ ...ROW, provenanceSource: undefined }}
        detail={detail({ basis: null, adjustments: [] })}
        tier="plain"
      />,
    )
    expect(screen.queryByTestId('model-detail-v2-provenance')).toBeNull()
  })
})
