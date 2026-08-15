/**
 * Model tab v2 — THE OUTLINE (design §4.1, §4.3).
 *
 * The load-bearing test in this file is "the tier changes content, never
 * layout" — design §2 F1, the defect that makes the advanced toggle overwhelm
 * non-scientists by being two controls wearing one switch. It is asserted twice
 * and in two different ways, deliberately: once against the PURE layout function
 * (which cannot take a tier at all), and once against the RENDERED DOM after a
 * real toggle, because a component is free to disobey a pure function it does
 * not call.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelOutline, outlineLayout } from '../ModelOutline'
import { MODEL_GROUP_IDS, type ModelGroupId, type ModelRow } from '../types'

function row(
  id: string,
  group: ModelGroupId,
  over: Partial<ModelRow> = {},
): ModelRow {
  return {
    id,
    kind: 'factor',
    group,
    label: `Label ${id}`,
    primaryValue: '1',
    attention: [],
    editable: true,
    ...over,
  }
}

/** Ids of the rendered rows, in DOM order — the object of every order assertion. */
function renderedRowIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="model-row-v2-"]'))
    .filter(el => el.getAttribute('data-kind') !== null)
    .map(el => el.getAttribute('data-testid')!.replace('model-row-v2-', ''))
}

function openGroupIds(): string[] {
  return MODEL_GROUP_IDS.filter(
    id => screen.getByTestId(`model-group-v2-${id}`).getAttribute('data-open') === 'true',
  )
}

describe('ModelOutline — all seven groups, always present, in IA order', () => {
  it('renders every group even when the model has nothing in it', () => {
    render(<ModelOutline rows={[]} tier="plain" />)
    for (const id of MODEL_GROUP_IDS) {
      expect(screen.getByTestId(`model-group-v2-${id}`)).toBeInTheDocument()
    }
  })

  it('renders the groups in the declared IA order', () => {
    render(<ModelOutline rows={[]} tier="plain" />)
    const rendered = Array.from(document.querySelectorAll('[data-testid^="model-group-v2-"]'))
      .map(el => el.getAttribute('data-testid'))
      .filter((t): t is string => !!t && !t.endsWith('-toggle') && !t.endsWith('-empty'))
      .map(t => t.replace('model-group-v2-', ''))
    expect(rendered).toEqual([...MODEL_GROUP_IDS])
  })
})

describe('ModelOutline — renders exactly the rows it is given, in the order given', () => {
  it('does not sort, drop or invent rows', () => {
    // Deliberately NOT alphabetical: a component that sorted would produce
    // ['f1','f2','f3'] and pass a weaker assertion.
    const rows = [row('f3', 'factors'), row('f1', 'factors'), row('f2', 'factors')]
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(renderedRowIds()).toEqual(['f3', 'f1', 'f2'])
  })

  it('places each row in its DECLARED group, not one inferred from its kind', () => {
    // A `factor`-kind row declared into the relationships group must appear
    // there: the projection owns grouping, the outline does not second-guess it.
    render(
      <ModelOutline
        rows={[row('r1', 'relationships'), row('g1', 'goal')]}
        tier="plain"
      />,
    )
    const relationships = screen.getByTestId('model-group-v2-relationships')
    expect(relationships.querySelector('[data-testid="model-row-v2-r1"]')).not.toBeNull()
    expect(relationships.querySelector('[data-testid="model-row-v2-g1"]')).toBeNull()
  })

  it('reports rows whose group is not one of the seven rather than rendering them somewhere', () => {
    const rogue = { ...row('x1', 'factors'), group: 'not-a-group' as ModelGroupId }
    const { unknownGroupRowIds, groups } = outlineLayout([rogue], '', new Set(MODEL_GROUP_IDS))
    expect(unknownGroupRowIds).toEqual(['x1'])
    // And it is in NO group — a silent home would be worse than dropping it.
    expect(groups.flatMap(g => g.rows.map(r => r.id))).toEqual([])
  })
})

describe('⭐ ModelOutline — THE TIER IS A CONTENT SWITCH, NEVER A LAYOUT SWITCH (F1)', () => {
  it('the layout function cannot even see the tier (structural, not a promise)', () => {
    const rows = [row('f1', 'factors'), row('o1', 'options')]
    const open = new Set(MODEL_GROUP_IDS)
    // One call, one result — there is no tier argument to vary. If a future edit
    // wanted layout to depend on the tier, it would have to change this
    // signature, which is the point of isolating it.
    expect(outlineLayout(rows, '', open)).toEqual(outlineLayout(rows, '', open))
    expect(outlineLayout.length).toBe(3)
  })

  it('flipping the tier does not change WHICH GROUPS ARE OPEN', () => {
    const rows = [row('f1', 'factors'), row('o1', 'options')]
    const { rerender } = render(<ModelOutline rows={rows} tier="plain" />)

    // Close one group by hand, so the state under test is a USER's arrangement
    // rather than the default — the default would survive almost any bug.
    fireEvent.click(screen.getByTestId('model-group-v2-factors-toggle'))
    const openInPlain = openGroupIds()
    expect(openInPlain).not.toContain('factors')
    expect(openInPlain).toContain('options')

    rerender(<ModelOutline rows={rows} tier="advanced" />)
    expect(openGroupIds()).toEqual(openInPlain)
  })

  it('flipping the tier does not change ROW ORDER', () => {
    const rows = [row('f3', 'factors'), row('f1', 'factors'), row('f2', 'factors')]
    const { rerender } = render(<ModelOutline rows={rows} tier="plain" />)
    const plainOrder = renderedRowIds()

    rerender(<ModelOutline rows={rows} tier="advanced" />)
    expect(renderedRowIds()).toEqual(plainOrder)
  })

  it('flipping the tier DOES change content — the positive control', () => {
    // Without this, the two assertions above could both pass on a tier that does
    // nothing whatsoever, which would be a different bug wearing the same green.
    const rows = [row('f1', 'factors')]
    const { rerender } = render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f1-id')).toBeNull()

    rerender(<ModelOutline rows={rows} tier="advanced" />)
    expect(screen.getByTestId('model-row-v2-f1-id')).toBeInTheDocument()
  })
})

describe('ModelOutline — multi-open, independently remembered (F2)', () => {
  it('every group is open by default: opening Options never closes Factors', () => {
    render(<ModelOutline rows={[row('f1', 'factors'), row('o1', 'options')]} tier="plain" />)
    expect(openGroupIds()).toEqual([...MODEL_GROUP_IDS])
  })

  it('closing one group leaves every other group exactly as it was', () => {
    render(<ModelOutline rows={[row('f1', 'factors'), row('o1', 'options')]} tier="plain" />)
    fireEvent.click(screen.getByTestId('model-group-v2-options-toggle'))

    const open = openGroupIds()
    expect(open).not.toContain('options')
    // Identity-bound: name the survivors rather than counting them.
    expect(open).toContain('factors')
    expect(open).toContain('goal')
    expect(open).toContain('relationships')
  })

  it('a closed group is reopenable — the expander is not one-way', () => {
    render(<ModelOutline rows={[row('f1', 'factors')]} tier="plain" />)
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    fireEvent.click(toggle)
    expect(screen.getByTestId('model-group-v2-factors')).toHaveAttribute('data-open', 'false')
    fireEvent.click(toggle)
    expect(screen.getByTestId('model-group-v2-factors')).toHaveAttribute('data-open', 'true')
  })

  it('reports open/closed to assistive technology', () => {
    render(<ModelOutline rows={[]} tier="plain" />)
    expect(screen.getByTestId('model-group-v2-goal-toggle')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('ModelOutline — the filter actually filters (F3)', () => {
  it('keeps only rows whose label matches, case-insensitively', () => {
    const rows = [
      row('f1', 'factors', { label: 'Sales cycle length' }),
      row('f2', 'factors', { label: 'Win rate' }),
      row('f3', 'factors', { label: 'Pipeline coverage' }),
    ]
    render(<ModelOutline rows={rows} tier="plain" filter="SALES" />)
    expect(renderedRowIds()).toEqual(['f1'])
  })

  it('preserves the caller\'s order among the rows that match', () => {
    const rows = [
      row('f3', 'factors', { label: 'rate three' }),
      row('f1', 'factors', { label: 'rate one' }),
      row('f2', 'factors', { label: 'other' }),
    ]
    render(<ModelOutline rows={rows} tier="plain" filter="rate" />)
    expect(renderedRowIds()).toEqual(['f3', 'f1'])
  })

  it('keeps every group heading present and says a group has no matches', () => {
    render(
      <ModelOutline
        rows={[row('f1', 'factors', { label: 'Sales cycle' })]}
        tier="plain"
        filter="sales"
      />,
    )
    // The heading survives, so the user never wonders whether a group vanished.
    expect(screen.getByTestId('model-group-v2-options')).toBeInTheDocument()
    expect(screen.getByTestId('model-group-v2-options-empty')).toHaveTextContent(
      'No matches in this group',
    )
  })

  it('distinguishes "nothing here yet" from "nothing matched"', () => {
    render(<ModelOutline rows={[]} tier="plain" />)
    expect(screen.getByTestId('model-group-v2-options-empty')).toHaveTextContent(
      'Nothing in this group yet',
    )
  })
})
