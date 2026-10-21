/**
 * ⭐ AN ITEM OLUMI ADDED SAYS SO, ON A CORE SCENARIO (DL ruling 21 Oct 2026, Lenses audit gap (a)). Core's engine graph
 * stamps only a value's source; the item's author is the living model's `source`, read by the item's id. Bound to the
 * card's own mark (`NodeProvenanceMark`) and the hover card's facts (`nodeHoverFacts`), the two readers of item authorship.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { livingSourceOf, withLivingAuthorship } from '../livingAuthorship'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { nodeHoverFacts } from '../../../components/hoverCard/NodeHoverCard'

/** The saved graph as the core route returns it: the engine nodes carry no `provenance`; the living model names authors. */
const GRAPH = {
  nodes: [{ id: 'risk_churn', kind: 'risk', label: 'Key client churns' }, { id: 'opt_hire', kind: 'option', label: 'Hire' }],
  living_model: {
    aims: [], links: [], conditions: [], views: [], history: [],
    options: [{ id: 'opt_hire', label: 'Hire', source: 'user' }],
    factors: [{ id: 'fac_load', label: 'Onboarding load', source: 'olumi' }],
    risks: [{ id: 'risk_churn', label: 'Key client churns', source: 'olumi' }],
  },
}
const RISK = { label: 'Key client churns' }
const OPTION = { label: 'Hire' }

describe('the item\'s author, read from the living model by its id', () => {
  it('reads each kind by id; an id it does not hold, or a graph with no living model, is null', () => {
    expect(livingSourceOf(GRAPH, 'risk_churn')).toBe('olumi')
    expect(livingSourceOf(GRAPH, 'fac_load')).toBe('olumi')
    expect(livingSourceOf(GRAPH, 'opt_hire')).toBe('user')
    expect(livingSourceOf(GRAPH, 'nope')).toBeNull()
    expect(livingSourceOf({ nodes: GRAPH.nodes }, 'risk_churn')).toBeNull()
  })

  it('⭐ the card: a risk Olumi added carries the "Olumi suggested this" mark', () => {
    render(<NodeProvenanceMark nodeType="risk" data={withLivingAuthorship(RISK, livingSourceOf(GRAPH, 'risk_churn'))} />)
    expect(screen.getByLabelText('Olumi suggested this')).toBeInTheDocument()
  })

  it('⛔ CONTRAST: the person\'s own option, and a card with no living model, carry no Olumi mark', () => {
    const { container } = render(<NodeProvenanceMark nodeType="option" data={withLivingAuthorship(OPTION, livingSourceOf(GRAPH, 'opt_hire'))} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByLabelText('Olumi suggested this')).toBeNull()
    expect(withLivingAuthorship(RISK, null)).toBe(RISK)
  })

  it('⛔ a card that already names its author keeps its own word', () => {
    const own = { ...RISK, provenance: 'user_provided' }
    expect(withLivingAuthorship(own, 'olumi')).toBe(own)
  })

  it('⭐ the hover card says the same as the card', () => {
    const data = withLivingAuthorship(RISK, livingSourceOf(GRAPH, 'risk_churn'))
    expect(nodeHoverFacts('risk_churn', 'risk', data, [], []).source).toBe('Olumi suggested this')
    expect(nodeHoverFacts('risk_churn', 'risk', RISK, [], []).source).toBeNull()
  })
})
