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
import { MODEL_OUTLINE_LABELS } from '../ViewModelTab'
import { ViewModelTab } from '../ViewModelTab'
import { MODEL_ROW_LABELS } from '../model/ModelCardRow'
import { resetModelTab, useModelTab } from '../model/state'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'
import { MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE } from '../../canvas/domain/vocabulary'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
const model = view.model!
afterEach(() => { cleanup(); try { localStorage.clear() } catch { /* none */ } resetModelTab() })

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
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
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

  it('catch (Model-tab port contract, 7 Nov): each aim and limit carries its target in core\'s words, Olumi\'s mark only where core gives one; a card with no target draws none', () => {
    const real = (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/european-22cards.view3.json'), 'utf8')) as View).model!
    const c = render(<ViewModelTab model={real} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    const bounded = real.cards.filter((k) => k.bound !== null)
    expect(bounded.map((k) => k.family).sort()).toEqual(['goal', 'limit', 'limit'])
    for (const card of bounded) {
      const row = c.querySelector(`[data-model-row="${card.id}"]`)!
      expect(row.querySelector(`[data-view="${card.id}.bound.text"]`)?.textContent, card.id).toBe(card.bound!.text)
      expect(row.querySelector(`[data-view="${card.id}.bound.olumi.glyph"]`)?.textContent ?? null, card.id).toBe(card.bound!.olumi?.glyph ?? null)
    }
    expect(bounded.some((k) => k.bound!.olumi !== null) && bounded.some((k) => k.bound!.olumi === null)).toBe(true) // both kinds exercised
    const plain = real.cards.find((k) => k.bound === null && c.querySelector(`[data-model-row="${k.id}"]`) !== null)!
    expect(c.querySelector(`[data-model-row="${plain.id}"] [data-view$=".bound.text"]`)).toBeNull() // CONTRAST
  })

  it('a row\'s press puts its card in front, through the canvas\'s focus, by its id', () => {
    const focus = vi.fn()
    const off = registerFocusHelpers(focus, () => undefined)
    const c = render(<ViewModelTab model={model} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    fireEvent.click(c.querySelector('[data-model-row="customers"]')!)
    expect(focus).toHaveBeenCalledWith('customers')
    off()
  })
})

// The previous PoC's outline (Paul, 6 Nov side-by-side: every item expanded, no colours, no filter): the question above five closed
// headings, each with its kind's canvas shape in its family colour and its count; "Expand all" opens them; a filter opens what matches.
describe('the Model tab reads as the previous PoC\'s outline', () => {
  it('catch: closed on open, each heading its shape, colour and count; Expand all opens every group; a filter narrows by heading', () => {
    const c = render(<ViewModelTab model={model} />).container
    expect(c.querySelector('h3')?.textContent).toBe(MODEL_OUTLINE_LABELS.title)
    expect(c.querySelector('[data-testid="view-model-question"] [data-view="model.question.text"]')?.textContent).toBe(model.question.text)
    expect(c.querySelectorAll('[data-model-row]').length).toBe(0) // closed on open
    const groups = modelGroupsOf(model)
    for (const g of groups) {
      if (g.cards.length === 0 && g.id !== 'goal') continue
      const toggle = c.querySelector(`[data-model-group-toggle="${g.id}"]`)!
      expect(toggle.getAttribute('aria-expanded'), g.id).toBe('false')
      expect(c.querySelector(`[data-model-group-count="${g.id}"]`)?.textContent, g.id).toBe(String(g.cards.length + (g.id === 'goal' ? 1 : 0)))
    }
    expect(c.querySelector('[data-model-group-toggle="options"] rect')?.getAttribute('fill')).toBe('var(--option)')
    expect(c.querySelector('[data-model-group-toggle="factors"] circle')?.getAttribute('fill')).toBe('var(--factor)')
    expect(c.querySelector('[data-model-group-toggle="goal"] polygon')?.getAttribute('fill')).toBe('var(--goal)')
    expect(c.querySelector('[data-model-group-count="relationships"]')?.textContent).toBe(String(model.links.length))
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    expect(c.querySelectorAll('[data-model-row]').length).toBe(groups.reduce((n, g) => n + g.cards.length, 0))
    expect(c.querySelector('[data-testid="view-model-toggle-all"]')?.textContent).toBe(MODEL_OUTLINE_LABELS.collapse)
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    expect(c.querySelectorAll('[data-model-row]').length).toBe(0)
    // A filter: one option's heading opens its group with that row alone; words nothing carries say so.
    const option = groups.find((g) => g.id === 'options')!.cards[0]!
    fireEvent.change(c.querySelector('[data-testid="view-model-filter"]')!, { target: { value: option.heading.toUpperCase() } })
    expect([...c.querySelectorAll('[data-model-row]')].map((r) => r.getAttribute('data-model-row'))).toEqual([option.id])
    fireEvent.change(c.querySelector('[data-testid="view-model-filter"]')!, { target: { value: 'zzqx no such words' } })
    expect(c.querySelectorAll('[data-model-row]').length).toBe(0)
    expect(c.querySelector('[data-testid="view-model-no-match"]')?.textContent).toBe(MODEL_OUTLINE_LABELS.none)
  })
})

// R25 (Paul 7 Nov): the crafted Model tab reinstated. Its row (ModelRowView, MODEL-1), its mark (ValueProvenanceMark) and its Insights
// disclosure (FactorInsights), every word core's, bound by identity: each premise by its card id and its place in `premises`.
describe('the crafted Model tab, from the View', () => {
  const open = () => { const c = render(<ViewModelTab model={model} />).container; fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!); return c }

  it('catch (Expert): a card\'s premises sit behind its own closed disclosure, each in core\'s words under core\'s key word for its glyph; a card with none has none', () => {
    const focus = vi.fn()
    const off = registerFocusHelpers(focus, () => undefined)
    useModelTab.getState().setExpert(true)
    const c = open()
    const card = model.cards.find((k) => k.id === 'broader_entry')!
    expect(card.premises.length).toBeGreaterThan(1)
    const toggle = c.querySelector<HTMLButtonElement>(`[data-model-premises-toggle="${card.id}"]`)!
    expect(toggle.textContent).toBe(`${MODEL_ROW_LABELS.restsOn}${card.premises.length}`)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(c.querySelector(`[data-view="${card.id}.premises.0.text"]`)).toBeNull() // closed by default
    expect(c.querySelector(`[data-model-row="${card.id}"]`)!.contains(toggle)).toBe(false) // never inside the row's button
    fireEvent.click(toggle)
    expect(focus).not.toHaveBeenCalled() // opening it does not move the canvas
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    card.premises.forEach((p, i) => {
      expect(c.querySelector(`[data-view="${card.id}.premises.${i}.text"]`)?.textContent, `premise ${i}`).toBe(p.text)
      const heading = c.querySelector(`[data-view-premise="${card.id}.premises.${i}"]`)!.closest('div')!.querySelector('[data-view-key]')
      const entry = model.key.find((k) => k.glyph === p.glyph)!
      expect(heading?.getAttribute('data-view-key'), `premise ${i}`).toBe(entry.id)
      expect(heading?.textContent, `premise ${i}`).toBe(`${entry.glyph} ${entry.text}`)
    })
    // CONTRAST: a card that rests on nothing draws no disclosure.
    const bare = model.cards.find((k) => k.id === 'starting_customers')!
    expect(bare.premises).toEqual([])
    expect(c.querySelector(`[data-model-row="${bare.id}"]`)).not.toBeNull()
    expect(c.querySelector(`[data-model-premises-toggle="${bare.id}"]`)).toBeNull()
    off()
  })

  it('Plain keeps the premises one press away, each with its glyph and core\'s words, without the Expert headings', () => {
    expect(useModelTab.getState().expert).toBe(false) // Plain on a first visit
    const c = open()
    const card = model.cards.find((k) => k.id === 'broader_entry')!
    fireEvent.click(c.querySelector(`[data-model-premises-toggle="${card.id}"]`)!)
    card.premises.forEach((p, i) => {
      const item = c.querySelector(`[data-view-premise="${card.id}.premises.${i}"]`)!
      expect(item.querySelector(`[data-view="${card.id}.premises.${i}.text"]`)?.textContent, `premise ${i}`).toBe(p.text)
      expect(item.textContent, `premise ${i}`).toBe(`${p.glyph}${p.text}`)
    })
    expect(c.querySelector(`[data-model-premises="${card.id}"] [data-view-key]`)).toBeNull() // CONTRAST: no Expert headings
  })

  it('catch: Olumi\'s mark sits on the figure it marks, once, with core\'s hover; an unmarked figure carries none; the key names only marks on screen', () => {
    const c = open()
    const marked = model.cards.find((k) => k.figure !== null && k.olumi !== null)!
    const glyphs = c.querySelectorAll(`[data-view="${marked.id}.olumi.glyph"]`)
    expect(glyphs.length).toBe(1)
    expect(glyphs[0]!.textContent).toBe(marked.olumi!.glyph)
    expect(glyphs[0]!.getAttribute('aria-label')).toBe(marked.olumi!.title)
    expect(glyphs[0]!.parentElement!.querySelector(`[data-view="${marked.id}.figure.text"]`)).not.toBeNull() // beside its figure
    const unmarked = model.cards.find((k) => k.figure !== null && k.olumi === null)!
    expect(c.querySelector(`[data-model-row="${unmarked.id}"] [role="img"]`)).toBeNull() // CONTRAST: absence drawn as absence
    expect([...c.querySelectorAll('[data-testid="view-model-key"] [data-view-key]')].map((k) => k.textContent)).toEqual(
      model.key.filter((k) => k.id === 'olumi').map((k) => `${k.glyph} ${k.text}`)) // ◆ only: no card here is partly Olumi's
  })

  // The wire: core's own re-pinned golden at wip/summary a62f0899 (src/view/__tests__/golden/bakery.view3.json), which serves
  // `cards[].author`. Every card in the tab is checked by its id: a person's carries the icon named in core's words; Olumi's carries
  // core's ◆ alone; a card core gives no author carries nothing.
  it('wire (core a62f0899): each card says whose it is in core\'s words, a person\'s by its icon, Olumi\'s by core\'s ◆; none, none', () => {
    const bakery = (JSON.parse(readFileSync(path.resolve('src/olumiView/model/fixtures/bakery-author.core-a62f0899.view3.json'), 'utf8')) as View).model!
    const c = render(<ViewModelTab model={bakery} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    type A = { by: string; text: string; title: string } | null | undefined
    const authorOf = (id: string) => (bakery.cards.find((k) => k.id === id) as unknown as { author: A }).author
    const drawn = [...c.querySelectorAll('[data-model-row]')].map((r) => r.getAttribute('data-model-row')!)
    expect(drawn.length).toBe(bakery.cards.length)
    const seen = new Set<string>()
    for (const id of drawn) {
      const a = authorOf(id), icon = c.querySelector(`[data-view-author="${id}"]`)
      seen.add(a == null ? 'none' : a.by)
      if (a != null && a.by === 'person') {
        expect([icon?.getAttribute('aria-label'), icon?.getAttribute('title'), icon?.getAttribute('data-author-by')], id).toEqual([a.text, `${a.text}\n${a.title}`, 'person'])
      } else {
        expect(icon, id).toBeNull()
        if (a?.by === 'olumi') expect(c.querySelectorAll(`[data-view="${id}.olumi.glyph"]`).length, id).toBe(1)
      }
    }
    expect([...seen].sort()).toEqual(['olumi', 'person']) // both kinds exercised on the wire
    // A party core names is drawn as core names it, never as "the team".
    expect(c.querySelector('[data-view-author="repair_chance"]')?.getAttribute('aria-label')).toBe(authorOf('repair_chance')!.text)
  })

  // ⚠ LABELLED FIXTURE, NOT THE WIRE: core reserves `by: 'brief'` but does not emit it yet (a figure from the brief and one a member typed
  // share one stored origin until the write side records the split). Its words here are invented for the test; replace with a wire View
  // once core emits it. A shape core never sends reads as absent.
  it('FIXTURE (core reserves `brief`): the brief\'s figure carries its own icon in core\'s words; an unreadable author draws nothing', () => {
    const withAuthor = structuredClone(model)
    const set = (id: string, author: unknown) => { (withAuthor.cards.find((k) => k.id === id) as unknown as { author: unknown }).author = author }
    set('starting_customers', { by: 'brief', text: 'From your brief', title: 'Theirs: “we have about 400 customers today”' })
    set('investment_cap', { by: 'someone', text: 'x', title: 'y' })
    set('customers', { by: 'olumi', text: 'Olumi’s estimate', title: 'Proposed by Olumi' })
    const c = render(<ViewModelTab model={withAuthor} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    const brief = c.querySelector('[data-view-author="starting_customers"]')!
    expect([brief.getAttribute('data-author-by'), brief.getAttribute('aria-label'), brief.getAttribute('title')]).toEqual(['brief', 'From your brief', 'From your brief\nTheirs: “we have about 400 customers today”'])
    expect(c.querySelector('[data-view-author="investment_cap"]')).toBeNull() // a shape core never sends: nothing
    expect(c.querySelector('[data-view-author="customers"]')).toBeNull() // Olumi's: core's ◆ alone, drawn once
    expect(c.querySelectorAll('[data-view="customers.olumi.glyph"]').length).toBe(1)
    expect(c.querySelector('[data-view-author="customer_target"]')).toBeNull() // CONTRAST: no author, no icon
  })
})

// R25 (Paul's finish line: no cut text). An option with no chance in this model says why in core's words; the Model tab draws them whole.
describe('the Model tab: an option row core gives no chance keeps its words whole', () => {
  it('catch: each none row of core\'s app-launch golden is drawn at its path, whole, with no clamp on it or around it', () => {
    const v: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8'))
    const c = render(<ViewModelTab model={v.model!} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    let n = 0
    for (const card of v.model!.cards.filter((k) => k.family === 'option')) {
      card.rows.forEach((r, i) => {
        if (r.kind !== 'none') return
        const words = r.text ?? r.title
        const el = c.querySelector(`[data-view="${card.id}.rows.${i}.${r.text == null ? 'title' : 'text'}"]`)
        expect(el, `${card.id}.rows.${i}`).not.toBeNull()
        expect(el!.textContent).toBe(words)
        for (let a: Element | null = el; a !== null && a !== c; a = a.parentElement) expect(a.className, `${card.id}.rows.${i}`).not.toMatch(/line-clamp|truncate/)
        n++
      })
    }
    expect(n).toBeGreaterThan(2)
  })
})


// UI audit of cc75a10a (7 Nov): the key names only the marks drawn; the deliberate Model-tab changes are bound by identity, so reverting
// either goes red.
describe('the key, and what the Model tab deliberately does not draw', () => {
  const keyTexts = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="view-model-key"] [data-view-key]')].map((k) => k.textContent)
  const olumi = model.key.find((k) => k.id === 'olumi')!

  it('catch: on first open every group is closed and no mark is drawn, so no key; opened, the key names the marks on screen', () => {
    const c = render(<ViewModelTab model={model} />).container
    expect(c.querySelectorAll('[data-model-row]').length).toBe(0)
    expect(c.querySelector('[data-testid="view-model-key"]')).toBeNull()
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    expect(keyTexts(c)).toContain(`${olumi.glyph} ${olumi.text}`)
  })

  it('catch: a filter that hides every marked card leaves no key; one that shows a marked card brings it back', () => {
    const plain = model.cards.find((k) => k.id === 'starting_customers')!
    const marked = model.cards.find((k) => k.id === 'customers')!
    expect([plain.olumi, marked.olumi?.glyph]).toEqual([null, olumi.glyph])
    const c = render(<ViewModelTab model={model} />).container
    fireEvent.change(c.querySelector('[data-testid="view-model-filter"]')!, { target: { value: plain.heading } })
    expect([...c.querySelectorAll('[data-model-row]')].map((r) => r.getAttribute('data-model-row'))).toEqual([plain.id])
    expect(c.querySelector('[data-testid="view-model-key"]')).toBeNull()
    fireEvent.change(c.querySelector('[data-testid="view-model-filter"]')!, { target: { value: marked.heading } })
    expect(c.querySelector(`[data-model-row="${marked.id}"]`)).not.toBeNull()
    expect(keyTexts(c)).toContain(`${olumi.glyph} ${olumi.text}`)
  })

  it('catch: an option row\'s companion line shows in Plain and in Expert (Olumi\'s part stays visible to be challenged); its timing line only in Expert', () => {
    // ⚠ LABELLED FIXTURE: no golden carries a companion or timing line on a Model-tab option, so one chance row is given both.
    const withLines = structuredClone(model)
    const option = withLines.cards.find((k) => k.family === 'option' && k.rows.some((r) => r.kind === 'chance'))!
    const i = option.rows.findIndex((r) => r.kind === 'chance')
    Object.assign(option.rows[i]!, { companion: 'about 50% without it', companion_title: 'x', timing: 'by month 6', timing_title: 'y' })
    const c = render(<ViewModelTab model={withLines} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    const at = `${option.id}.rows.${i}`
    const line = (what: string) => c.querySelector(`[data-view-row="${at}"] [data-view="${at}.${what}"]`)
    expect(useModelTab.getState().expert).toBe(false)
    expect(line('companion')?.textContent).toBe('about 50% without it')
    expect(line('timing')).toBeNull()
    fireEvent.click(c.querySelector('[data-model-expert-arm="expert"]')!)
    expect(line('companion')?.textContent).toBe('about 50% without it')
    expect(line('timing')?.textContent).toBe('by month 6')
  })

  it('catch: a link\'s label is a mark after its words, on its first line; its strength (Expert) is line 2, outside that line', () => {
    // ⚠ LABELLED FIXTURE: no golden has a labelled link with a strength, so the first labelled link is given one.
    const sized = structuredClone(model)
    const k = sized.links.findIndex((l) => l.label !== '')
    sized.links[k] = { ...sized.links[k]!, effect: { text: '1.5 to 2', title: 'z', figure: 'starting_customers' } }
    const c = render(<ViewModelTab model={sized} />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    const line = c.querySelector(`[data-model-link-line="links.${k}"]`)!
    const label = line.querySelector(`[data-view="links.${k}.label"]`)!
    expect(label.textContent).toBe(sized.links[k]!.label)
    // After its words: the label's text follows the link's "to" heading, and nothing of the line follows the label.
    expect(line.textContent!.endsWith(`${linkEndHeading(sized, sized.links[k]!.to)}\u00a0${sized.links[k]!.label}`)).toBe(true)
    expect(c.querySelector(`[data-view="links.${k}.effect.text"]`)).toBeNull() // Plain: the strength is Expert's
    fireEvent.click(c.querySelector('[data-model-expert-arm="expert"]')!)
    const strength = c.querySelector(`[data-view="links.${k}.effect.text"]`)!
    expect(line.isConnected).toBe(true)
    expect(line.contains(strength)).toBe(false)
    expect(strength.className).toContain('block')
    expect(line.compareDocumentPosition(strength) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
