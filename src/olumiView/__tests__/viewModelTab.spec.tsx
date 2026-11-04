/**
 * The Model tab on the core lane (DL 4 Nov, R2): the legacy outline's groups, drawn from core's View, every word core's; a row's press puts
 * its card in front through the canvas's own focus. Fixture: the european View from the wire. Bound by identity (each row by its card id).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { drawKindOf, linkEndHeading, modelGroupsOf } from '../layout'
import { ViewModelTab } from '../ViewModelTab'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'
import { MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE } from '../../canvas/domain/vocabulary'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
const model = view.model!
afterEach(cleanup)

describe('the Model tab, from the View', () => {
  it('the legacy groups in order; each card in the group its canvas kind says, assumptions and conditions in none', () => {
    const groups = modelGroupsOf(model)
    expect(groups.map((g) => g.title)).toEqual([MODEL_TAB_GOAL_GROUP_TITLE, MODEL_GROUP_TITLE.options, MODEL_GROUP_TITLE.factors, MODEL_GROUP_TITLE.outcomesRisks])
    const where = new Map(groups.flatMap((g) => g.cards.map((c) => [c.id, g.id] as const)))
    for (const c of model.cards) {
      const kind = drawKindOf(c, model)
      const want = c.family === 'assumption' || c.family === 'condition' ? undefined
        : kind === 'goal' || kind === 'constraint' ? 'goal' : kind === 'option' ? 'options' : kind === 'factor' ? 'factors' : 'outcomes-risks'
      expect(where.get(c.id), c.id).toBe(want)
    }
    expect(groups.find((g) => g.id === 'options')!.cards.map((c) => c.id)).toEqual(['broader_entry', 'single_country_test', 'no_new_european_entry'])
  })

  it('drawn: the question, each card\'s heading and figure in core\'s words, every link from its card to its card', () => {
    const c = render(<ViewModelTab model={model} />).container
    expect(c.querySelector('[data-view="model.question.text"]')?.textContent).toBe(model.question.text)
    for (const card of modelGroupsOf(model).flatMap((g) => g.cards)) {
      const row = c.querySelector(`[data-model-row="${card.id}"]`)!
      expect(row.querySelector(`[data-view="${card.id}.heading"]`)?.textContent, card.id).toBe(card.heading)
      if (card.figure !== null) expect(row.querySelector(`[data-view="${card.id}.figure.text"]`)?.textContent, card.id).toBe(card.figure.text)
    }
    const links = c.querySelectorAll('[data-model-link]')
    expect(links.length).toBe(model.links.length)
    model.links.forEach((l, i) => expect(links[i]!.textContent, `links.${i}`).toContain(`${linkEndHeading(model, l.from)} → ${linkEndHeading(model, l.to)}`))
    // CONTRAST: an assumption is not listed
    const assumption = model.cards.find((x) => x.family === 'assumption')!
    expect(c.querySelector(`[data-model-row="${assumption.id}"]`)).toBeNull()
  })

  it('a row\'s press puts its card in front, through the canvas\'s focus, by its id', () => {
    const focus = vi.fn()
    const off = registerFocusHelpers(focus, () => undefined)
    const c = render(<ViewModelTab model={model} />).container
    fireEvent.click(c.querySelector('[data-model-row="customers"]')!)
    expect(focus).toHaveBeenCalledWith('customers')
    off()
  })
})
