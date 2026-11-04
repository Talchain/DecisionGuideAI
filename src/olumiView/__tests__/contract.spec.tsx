/**
 * The View API design's §3 contract for every UI, on DGAI's View-fed surfaces:
 * - each drawn element carries `data-view`, the path to its View string, and its text is exactly that string (bound by identity:
 *   text that merely exists elsewhere in the View does not pass);
 * - nothing is dropped: every option card's heading and every row is drawn;
 * - a mutant that swaps two options' rows fails;
 * - the lint: outside the one layout module, src/olumiView/ formats, sorts, filters and reduces nothing, and reads no CEE shape.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { driverRange, ViewChances, ViewChancesBlock } from '../ViewChances'
import { useViewStore } from '../store'

// Paths from the repository root (vitest's working directory): jsdom gives this module no file: URL to resolve against.
const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const

/** The View string a `data-view` path names: `run.<field>…` under the model's Run, else `<card id>.<field>…` under its cards. */
function at(model: ViewModel, path: string): unknown {
  const [id, ...rest] = path.split('.')
  let x: unknown = id === 'run' ? model.run : model.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

describe('the chances block draws the View exactly (design §3)', () => {
  for (const n of GOLDEN) {
    it(`${n}: every drawn string is the View's own string at its path, and every option and row is drawn`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      const drawn = [...container.querySelectorAll<HTMLElement>('[data-view]')]
      for (const el of drawn) {
        const want = at(model, el.dataset['view']!)
        expect(typeof want, el.dataset['view']).toBe('string')
        expect(el.textContent, el.dataset['view']).toBe(want)
      }
      // a string drawn as a mark's label (v10's driver marker) is the View's own string at its path, and the mark draws no text
      for (const el of container.querySelectorAll<HTMLElement>('[data-view-label]')) {
        expect(el.getAttribute('aria-label'), el.dataset['viewLabel']).toBe(at(model, el.dataset['viewLabel']!))
        expect(el.textContent, el.dataset['viewLabel']).toBe('')
      }
      for (const card of model.cards.filter((c) => c.family === 'option' && c.status === null)) {
        expect(container.querySelector(`[data-view="${card.id}.heading"]`), card.id).not.toBeNull()
        card.rows.forEach((_, i) => expect(container.querySelector(`[data-view-row="${card.id}.rows.${i}"]`), `${card.id} row ${i}`).not.toBeNull())
      }
    })
  }

  it('an option core does not compare (its card says "removed" or "ruled out") draws no chance line, as the base leaves it out (review 00051 P2)', () => {
    const model = structuredClone(golden('pricing').model!)
    const [kept, out] = model.cards.filter((c) => c.family === 'option')
    out!.status = 'removed'
    const { container } = render(<ViewChances model={model} />)
    expect(container.querySelector(`[data-view-card="${out!.id}"]`)).toBeNull()
    expect(container.querySelector(`[data-view-card="${kept!.id}"]`)).not.toBeNull()
  })

  it('a View whose two options\' chances are swapped draws differently for each option (identity, not a value somewhere)', () => {
    const model = golden('pricing').model!, swapped = structuredClone(model)
    const [a, b] = swapped.cards.filter((c) => c.family === 'option')
    ;[a!.rows, b!.rows] = [b!.rows, a!.rows]
    const text = (m: ViewModel, id: string) => render(<ViewChances model={m} />).container.querySelector(`[data-view-card="${id}"]`)!.textContent
    expect(text(swapped, a!.id)).not.toBe(text(model, a!.id))
    expect(text(swapped, b!.id)).not.toBe(text(model, b!.id))
  })
})

describe('the lint over the View render chain (design §3)', () => {
  const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'types.ts')
  it('reads the files it lints', () => expect(files).toEqual(expect.arrayContaining(['client.ts', 'layout.ts', 'store.ts', 'ViewChances.tsx'])))
  for (const f of files) {
    it(`${f}: no formatting or ordering of View values${f === 'layout.ts' ? ' (picking is allowed here only)' : ', no picking'}; no CEE shapes`, () => {
      const src = readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      for (const banned of ['toFixed(', 'toPrecision(', 'toLocaleString(', 'Intl.', '.sort(', '.reduce(', 'Math.round(']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false)
      if (f !== 'layout.ts') expect(src.includes('.filter('), `${f}: .filter(`).toBe(false)
      for (const cee of ['canonicalAnalysisView', 'runView', 'adapters/cee', 'scripts/olumi-core']) expect(src.includes(cee), `${f}: ${cee}`).toBe(false)
    })
  }
})

describe('nothing the View says on a line is dropped (review 00049)', () => {
  /**
   * Every visible string a row carries: its words and marks, never its hovers (`title`), its kind or its aim's id. Nor its `outcome`
   * (olumi.view/3 at core c838f56: the run's low / median / high and unit, numbers for the option card's outcome band, the v10 slot under
   * status line 2), which no line of this block draws: deliberately exempt, so the band, not this list, owns it.
   */
  const shownStrings = (row: Record<string, unknown>, at: string): string[] => Object.entries(row).flatMap(([k, v]) =>
    typeof v === 'string' ? (v !== '' && k !== 'kind' && k !== 'aim_id' && k !== 'title' ? [`${at}.${k}`] : [])
    : v !== null && typeof v === 'object' && k !== 'outcome' ? shownStrings(v as Record<string, unknown>, `${at}.${k}`) : [])
  for (const n of GOLDEN) {
    it(`${n}: every word and mark on every option line is drawn, and each line carries core's hover`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      for (const card of model.cards.filter((c) => c.family === 'option' && c.status === null)) card.rows.forEach((row, i) => {
        const at = `${card.id}.rows.${i}`
        for (const path of shownStrings(row as unknown as Record<string, unknown>, at)) expect(container.querySelector(`[data-view="${path}"]`), path).not.toBeNull()
        expect(container.querySelector(`[data-view-row="${at}"]`)?.getAttribute('title'), at).toBe(row.title)
      })
    })
  }
})

describe('the block draws only a current View of the approved model (review 00049)', () => {
  const view = golden('pricing')
  const block = () => render(<ViewChancesBlock />).container.querySelector('[data-testid="view-chances"]')
  afterEach(() => useViewStore.setState({ view: null, error: null, status: 'none' }))

  it('draws the approved model\'s lines when the last read succeeded', () => {
    useViewStore.setState({ view, error: null, status: 'ready' })
    expect(block()).not.toBeNull()
  })

  it('draws nothing from a View that holds a proposal: its lines are the proposal\'s, not the approved model the canvas shows', () => {
    useViewStore.setState({ view: { ...view, proposal: { id: 9, base: 1, heading: 'Olumi proposes 1 change', on: 'on version 1', removed: null, problem: null, marks: [], changes: [], groups: null, from: null } }, error: null, status: 'ready' })
    expect(block()).toBeNull()
  })

  it('draws nothing when the last read failed: older lines are never shown as current', () => {
    useViewStore.setState({ view, error: 'Olumi could not be read just now. Try again in a moment.', status: 'ready' })
    expect(block()).toBeNull()
  })
})

describe('each option says what moves its chance most, as the base dock did (00053 #2; core wip/view-dock dock.oracle.json)', () => {
  const oracle = JSON.parse(readFileSync(path.join(DIR, 'golden', 'dock.oracle.json'), 'utf8')) as Record<string, { drivers: Record<string, string | null> }>
  for (const n of GOLDEN.filter((g) => g !== 'proposal')) {
    it(`${n}: every option's driver line is the base dock's words, drawn under that option with core's hover`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      for (const [id, words] of Object.entries(oracle[n]!.drivers)) {
        const line = container.querySelector<HTMLElement>(`[data-view-card="${id}"] [data-view="${id}.driver.text"], [data-view-card="${id}"] [data-view-label="${id}.driver.text"]`)
        if (words === null) { expect(line, id).toBeNull(); continue }
        const driver = model.cards.find((c) => c.id === id)!.driver!
        // with core's two chances (driver.low/high) the line is v10's low→high marker, core's words its label; without them, the words
        if (driverRange(driver) !== null) { expect(line?.getAttribute('aria-label'), id).toBe(words); expect(line?.textContent, id).toBe('') }
        else expect(line?.textContent, id).toBe(words)
        expect(line?.getAttribute('title'), id).toBe(driver.title)
      }
    })
  }
})

describe('the Run beside the chances says what the base dock said, word for word (core wip/view-dock-words dock.oracle.json)', () => {
  type Oracle = { lead: string | null; most_likely: string | null; notes: string[]; waits_on: { text: string; items: { id: string }[] } | null }
  const oracle = JSON.parse(readFileSync(path.join(DIR, 'golden', 'dock.oracle.json'), 'utf8')) as Record<string, Oracle>
  const texts = (c: Element, sel: string) => [...c.querySelectorAll(sel)].map((e) => e.textContent)
  for (const n of GOLDEN.filter((g) => g !== 'proposal')) {
    it(`${n}: lead, most likely, notes in order, and what the chances wait on`, () => {
      const model = golden(n).model!, o = oracle[n]!
      const { container } = render(<ViewChances model={model} />)
      expect(container.querySelector('[data-view="run.lead"]')?.textContent ?? null).toBe(o.lead)
      expect(container.querySelector('[data-view="run.most_likely.text"]')?.textContent ?? null).toBe(o.most_likely)
      expect(texts(container, '[data-view^="run.notes."]')).toEqual(o.notes)
      if (o.waits_on === null) expect(container.querySelector('[data-testid="view-run-waits-on"]')).toBeNull()
      else {
        // When every option waits (core 534203e on), what they wait on heads the dock (its head and text), not the "Waits on:" line.
        if (model.run!.all_withheld) expect(container.querySelector('[data-testid="view-run-waits-headline"] [data-view="run.waits_on.text"]')?.textContent).toBe(model.run!.waits_on!.text)
        else expect(container.querySelector('[data-view="run.waits_on.label"]')?.textContent).toBe(model.run!.waits_on!.label)
        expect(texts(container, '[data-view^="run.waits_on.items."][data-view$=".text"]')).toEqual(model.run!.waits_on!.items.map((i) => i.text))
        expect(model.run!.waits_on!.items.map((i) => i.id)).toEqual(o.waits_on.items.map((i) => i.id))
        expect(model.run!.waits_on!.text).toBe(o.waits_on.text)
      }
    })
  }

  it('when every option waits, the dock heads with what they wait on, each unsized figure saying so, and no second waits-on line', () => {
    const model = structuredClone(golden('app-launch').model!)
    model.run!.all_withheld = true
    model.run!.waits_on!.items[0]!.unknown = ', which no one can size yet (no data)'
    const { container } = render(<ViewChances model={model} />)
    const head = container.querySelector('[data-testid="view-run-waits-headline"]')!
    expect(head.querySelector('[data-view="run.waits_on.head"]')?.textContent).toBe(model.run!.waits_on!.head)
    expect(head.querySelector('[data-view="run.waits_on.text"]')?.textContent).toBe(model.run!.waits_on!.text)
    expect(head.querySelector('[data-view="run.waits_on.items.0.unknown"]')?.textContent).toBe(', which no one can size yet (no data)')
    expect(container.querySelector('[data-testid="view-run-waits-on"]')).toBeNull()
  })
})

describe('a reason every option shares is said once, above the options; each covered card carries only core\'s mark (core 23bc745 run.shared_blockers)', () => {
  // pricing-unmoved-first: the View olumi-core 23bc745 serves for its own test case of that name (view.test.ts CASES), captured from it.
  type Oracle = { lead: string | null; withheld: Record<string, string> }
  const oracle = JSON.parse(readFileSync(path.join(DIR, 'golden', 'dock.oracle.json'), 'utf8')) as Record<string, Oracle>
  it('present: the Run\'s sentence once, in core\'s words, before every option; each covered option\'s row is the mark the dock oracle names', () => {
    const model = golden('pricing-unmoved-first').model!, shared = model.run!.shared_blockers!
    expect(shared).toHaveLength(1)
    const { container } = render(<ViewChances model={model} />)
    const said = [...container.querySelectorAll('[data-testid="view-run-shared-blocker"]')]
    expect(said.map((e) => [e.getAttribute('data-aim'), e.textContent])).toEqual(shared.map((b) => [b.aim_id, b.text]))
    // Said once on the whole block, and above the first option.
    expect(container.textContent!.split(shared[0]!.text).length - 1).toBe(1)
    const first = container.querySelector('[data-view-card]')!
    expect(said[0]!.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const [id, mark] of Object.entries(oracle['pricing-unmoved-first']!.withheld)) {
      expect(shared[0]!.options).toContain(id)
      const card = model.cards.find((c) => c.id === id)!, i = card.rows.findIndex((r) => r.aim_id === shared[0]!.aim_id)
      expect(container.querySelector(`[data-view-card="${id}"] [data-view="${id}.rows.${i}.text"]`)?.textContent, id).toBe(mark)
    }
    expect(container.querySelector('[data-view="run.lead"]')?.textContent).toBe(oracle['pricing-unmoved-first']!.lead)
  })
  it('absent: no View without the key draws a shared reason', () => {
    // (From core 89d09f0 the goldens carry the key where a blocker is shared: the absent case is made by taking it away.)
    for (const n of GOLDEN) {
      const model = structuredClone(golden(n).model)
      if (!model) continue
      if (model.run) delete model.run.shared_blockers
      expect(render(<ViewChances model={model} />).container.querySelector('[data-testid="view-run-shared-blocker"]'), n).toBeNull()
    }
  })
  it('present: each golden that carries the key draws exactly its own shared reasons, in core\'s words (analysis 48d6c6a15 kept)', () => {
    for (const n of GOLDEN) {
      const model = golden(n).model!, said = [...render(<ViewChances model={model} />).container.querySelectorAll('[data-testid="view-run-shared-blocker"]')]
      expect(said.map((e) => e.textContent), n).toEqual((model.run!.shared_blockers ?? []).map((b) => b.text))
      cleanup()
    }
  })
})

describe('worth checking first: each science line of the Run, in core\'s words, under the chances (olumi.view/3 model.run.science)', () => {
  it('present (bakery, european): every line verbatim and in order, its mark before it when it rests on Olumi\'s proposals, the Run\'s reason on hover', () => {
    for (const n of ['bakery', 'european']) {
      const model = golden(n).model!, science = model.run!.science
      expect(science.length, n).toBeGreaterThan(0)
      const { container } = render(<ViewChances model={model} />)
      const lines = [...container.querySelectorAll<HTMLElement>('[data-testid="view-run-worth"] [data-view-fact]')]
      expect(lines.map((p) => p.getAttribute('data-view-fact')), n).toEqual(science.map((l) => l.id))
      science.forEach((l, i) => {
        expect(lines[i]!.querySelector(`[data-view="run.science.${i}.line"]`)?.textContent, n).toBe(l.line)
        expect(lines[i]!.getAttribute('title'), n).toBe(l.hover)
        const mark = lines[i]!.querySelector(`[data-view="run.science.${i}.olumi.glyph"]`)
        if (l.olumi === null) expect(mark, n).toBeNull()
        else { expect(mark?.textContent, n).toBe(l.olumi.glyph); expect(mark?.getAttribute('title'), n).toBe(l.olumi.title) }
      })
    }
  })
  it('absent: a Run with no science line draws no block', () => {
    const model = golden('pricing').model!
    expect(model.run!.science).toEqual([])
    expect(render(<ViewChances model={model} />).container.querySelector('[data-testid="view-run-worth"]')).toBeNull()
  })
})

describe('a View from a core without the dock fields still draws (00058 P1)', () => {
  /** The same golden as an olumi.view/2 core before view-dock serves it: no `run`, no `driver`, `none` rows with no `text`. */
  const older = (n: string): ViewModel => {
    const model = structuredClone(golden(n).model!) as unknown as Record<string, unknown> & { cards: Record<string, unknown>[] }
    delete model['run']
    for (const c of model.cards) {
      delete c['driver']
      for (const r of c['rows'] as Record<string, unknown>[]) if (r['kind'] === 'none') delete r['text']
    }
    return model as unknown as ViewModel
  }
  for (const n of GOLDEN) {
    it(`${n}: no run block, no driver line, and each none row says its title`, () => {
      const model = older(n)
      const { container } = render(<ViewChances model={model} />)
      expect(container.querySelector('[data-view^="run."]')).toBeNull()
      expect(container.querySelector('[data-view$=".driver.text"]')).toBeNull()
      for (const c of model.cards) c.rows.forEach((r, i) => {
        if (r.kind === 'none') expect(container.querySelector(`[data-view="${c.id}.rows.${i}.title"]`)?.textContent).toBe(r.title)
      })
    })
  }
})
