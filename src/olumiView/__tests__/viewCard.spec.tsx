/**
 * The canvas card on the olumi-core lane (decision A): every card of every golden View drawn exactly as core wrote it, bound by
 * identity, every word drawn; and a proposed change shows core's mark with its hover naming each changed field (canvas A, 00052 #2).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { badgeFace, badgeNamed } from '../Badge'

const DIR = path.resolve('src/olumiView')
// The real dense boards from the R2 witness store (DL 4 Nov), walked as the goldens are.
const REAL = ['capacity', 'hiring'] as const
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal', ...REAL] as const
const golden = (n: string): View => JSON.parse(readFileSync((REAL as readonly string[]).includes(n) ? path.join(DIR, 'fixtures', 'real', `${n}.view3.json`) : path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))

function at(model: ViewModel, p: string): unknown {
  const [id, ...rest] = p.split('.')
  let x: unknown = model.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

/**
 * Every visible string a card carries: never a hover (`title`, or core's `detail`, which core's page uses as the hover and the card
 * gives its heading, DL 4 Nov), an aria label, an id or kind, the badge's record ids or its change
 * key, the figure editor's words (`edit`, drawn when the figure is edited, canvas A2), or an option's driver line, which the chances dock
 * draws as the base did (its canvas node never showed it), or a card's outcome band (`values`, olumi.view/3 since core e16a497) or a
 * chance row's aim outcome (`outcome`, since c838f56), which the Reasoning tab draws under each option; whether the card face draws them
 * too is the canvas's call; nor what an option rests on (`rests_on`, since c838f56: record ids with whose they are, a code, not words).
 */
// `outcome` (core c838f56): a chance row's low / median / high and unit, drawn by the option card's outcome band (the v10 slot), not
// as the row's words: deliberately exempt here.
// `values` (core e92f2a6): each option's outcome band for a figure, the v10 band's (the card's figure line already says it);
// `rests_on` (ids and whose, for the Rests-on lens): deliberately exempt too.
// A chance row's finding (`text`, at most two sentences) and its basis line (`rests_on_text`) (core 550ad5f, the R3 Analysis wall) are
// the Analysis tab's and the Summary's words (ViewChances, ViewBrief: viewFindings.spec), not the card face's: exempt here, the
// finding only on a chance row (a 'none' row's `text` is its face line). `rests_on` (row-level: the basis ids) is already exempt.
// `author` (core 6192ad6b, `cards[].author: { by, text, title }`): who stated the card's figure. The Model tab draws it (an icon whose name
// and hover are core's `text` and `title`: model/ModelCardRow.tsx AuthorMark, viewModelTab.spec); the canvas card has no slot for it
// and keeps Olumi's mark alone, so it is exempt from this surface's "every word drawn" set and from nothing else.
// Core's option headline (AN-01, paired at 73880d3d; card face, a7b03610): the canvas card draws `headline.text` with its title on hover;
// its `state` is a code, and its `range`, `why` and `add` lines are the Analysis panel's (HeroOptionRow, an01Headline.spec). A headline
// core marks `shared` is the panel's to say once (J1 step 3; sharedBlockerPanel.spec), so the card draws its rows instead.
const panelOnly = (card: ViewModel['cards'][number]): string[] => card.headline == null ? []
  : [...['state', 'range', 'why', 'add'].map((k) => `${card.id}.headline.${k}`), ...(card.headline.shared === true ? [`${card.id}.headline.text`] : [])]
// `sets` (core SCI-10 fd672840 (schema as 4d0c3634): an option's own settings, a lever id, its words and whose) are said once, in the Reasoning tab's rack
// (reasoning/Rack.tsx), not again on the canvas card: optionReasoning.spec SCI-10 binds each by path. A chance row's `state` is a machine
// key (no words); a withheld row's `question` is core's hover elsewhere, open whether it should be visible (contract.spec says why). Both are
// skipped by key name at any depth: today only chance rows carry them (a headline's `state` is panelOnly above).
const SKIP = new Set(['state', 'question', 'id', 'family', 'title', 'detail', 'label', 'kind', 'aim_id', 'records', 'edit', 'driver', 'outcome', 'values', 'rests_on', 'rests_on_text', 'author', 'sets'])
const shown = (x: unknown, p: string): string[] => typeof x === 'string' ? (x !== '' ? [p] : [])
  : Array.isArray(x) ? x.flatMap((y, i) => shown(y, `${p}.${i}`))
  : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (SKIP.has(k) || (k === 'change' && typeof y === 'string') || (k === 'text' && (x as { kind?: unknown }).kind === 'chance') ? [] : shown(y, `${p}.${k}`))) : []

/** The badge's own button, whichever way core words it (named: icon and words; else its text). */
const badgeButton = (c: Element, id: string) => c.querySelector(`[data-view="${id}.badge.face"], [data-view="${id}.badge.words"], [data-view="${id}.badge.text"]`)?.closest('button') ?? null
/** A badge as a core without `icon`/`words`/`face` sends it: its count text alone. */
const plainBadge = <B extends object>(b: B) => { const { icon: _i, words: _w, face: _f, ...rest } = b as B & { icon?: string; words?: string; face?: string }; return rest as B }

describe('the canvas card draws the View exactly', () => {
  for (const n of GOLDEN) {
    it(`${n}: every drawn string is the View's own at its path, and every word of every card is drawn`, () => {
      const model = golden(n).model!
      for (const card of model.cards) {
        const { container, unmount } = render(<ViewCard card={card} />)
        for (const el of container.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(model, el.dataset['view']!))
        const { id: _id, ...fields } = card
        // A worked-out figure with a line per option (two or more `values`) is drawn as those lines, a row per option, in place of its one
        // run-on sentence (R3 pristine): each option's line is then the drawn string, and the sentence stays the rows' hover (core's title).
        const perOption = card.figure !== null && (card.values?.length ?? 0) > 1
        const off = new Set(panelOnly(card))
        const all = shown(fields, card.id).filter((p) => !off.has(p))
        const want = perOption ? [...all.filter((p) => p !== `${card.id}.figure.text`), ...card.values!.map((_, i) => `${card.id}.values.${i}.text`)] : all
        // A badge core names (its `icon` and `words`, both sent) draws those in place of its count text (Badge.tsx badgeNamed: the count is
        // said once); `text` stays its name to a reader (core's `label`). Without both, `text` is drawn.
        // Since core 91fdf8a9 (DL 10 Nov) a badge sends its `face` (whole words within one line of the card): the face is drawn, its `words`
        // are the badge's hover (said whole, first), and its count text is not drawn again.
        const faced = card.badge !== null && badgeFace(card.badge) !== null
        const named = !faced && card.badge !== null && badgeNamed(card.badge) !== null
        const notDrawn = (p: string) => (named && p === `${card.id}.badge.text`) || (faced && [`${card.id}.badge.text`, `${card.id}.badge.words`, `${card.id}.badge.icon`].includes(p))
        for (const p of want) if (!notDrawn(p)) expect(container.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
        if (named || faced) expect(container.querySelector(`[data-view="${card.id}.badge.text"]`), `${card.id}.badge.text said once`).toBeNull()
        if (faced) {
          expect(container.querySelector(`[data-view="${card.id}.badge.face"]`)?.textContent, `${card.id}.badge.face`).toBe(card.badge!.face)
          expect(badgeButton(container, card.id)?.getAttribute('title')?.split('\n')[0], `${card.id}.badge.words on hover`).toBe(card.badge!.words)
        }
        // The drawn title carries core's detail whole on hover: the heading, or core's face title where it says something else (a7b03610).
        const titleEl = container.querySelector(`[data-view="${card.id}.face.title.text"]`) ?? container.querySelector(`[data-view="${card.id}.heading"]`)
        if (card.detail !== '') expect(titleEl?.getAttribute('title'), `${card.id}.detail on hover`).toBe(card.detail)
        unmount()
      }
    })
  }

  it('two cards swapped draw differently (identity, not a value found somewhere)', () => {
    const [a, b] = golden('pricing').model!.cards
    const text = (c: typeof a) => render(<ViewCard card={c!} />).container.textContent
    expect(text(a)).not.toBe(text(b))
  })
})

describe('a proposed change is seen on the card it changes, before approval (canvas A, review 00052 #2)', () => {
  const model = golden('proposal').model!
  const changed = model.cards.filter((c) => c.change !== null)
  it('the proposal golden holds changed cards', () => expect(changed.length).toBeGreaterThan(0))
  for (const card of changed) {
    it(`${card.id}: core's change mark is drawn, its hover names each changed field before → after`, () => {
      const mark = render(<ViewCard card={card} />).container.querySelector<HTMLElement>(`[data-view="${card.id}.change.glyph"]`)!
      expect(mark.textContent).toBe(card.change!.glyph)
      expect(mark.getAttribute('title')).toBe(card.change!.title)
      expect(card.change!.title).toMatch(/→/)
    })
  }
})

describe('a none row from a core before view-dock (no `text`) still says why (00058 P1)', () => {
  it('each such row draws its title', () => {
    let seen = 0
    for (const n of GOLDEN) for (const card of golden(n).model?.cards ?? []) card.rows.forEach((r, i) => {
      if (r.kind !== 'none') return
      const old = structuredClone(card) as unknown as { rows: Record<string, unknown>[] }
      delete old.rows[i]!['text']
      const c = render(<ViewCard card={old as unknown as typeof card} />).container
      expect(c.querySelector(`[data-view="${card.id}.rows.${i}.title"]`)?.textContent).toBe(r.title)
      seen++
    })
    expect(seen).toBeGreaterThan(0)
  })
})

describe('a badge opens what core folded into it (review 00002 ledger): a new read of the View with ?open=, nothing re-folded here', () => {
  it('pressing a closed badge reads the View with that card\'s records opened; pressing it open closes them', async () => {
    const { setTeamFetch } = await import('../../olumiCore/team/api')
    const { useViewStore } = await import('../store')
    const { fireEvent, waitFor } = await import('@testing-library/react')
    const view = golden('european'), card = view.model!.cards.find((c) => c.badge !== null)!
    const paths: string[] = []
    setTeamFetch((async (u: unknown) => { paths.push(decodeURIComponent(String(u))); return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
    useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view, opened: { open: new Map(), all: false }, status: 'ready', error: null, stale: false })
    const { container, rerender } = render(<ViewCard card={{ ...card, badge: { ...card.badge!, open: false } }} />)
    fireEvent.click(badgeButton(container, card.id)!)
    await waitFor(() => expect(paths.at(-1)).toBe(`/api/scenarios/s_0123456789ab/view?schema=3&open=${JSON.stringify({ [card.id]: card.badge!.records })}`))
    rerender(<ViewCard card={{ ...card, badge: { ...card.badge!, open: true } }} />)
    fireEvent.click(badgeButton(container, card.id)!)
    await waitFor(() => expect(paths.at(-1)).toBe('/api/scenarios/s_0123456789ab/view?schema=3'))
    setTeamFetch(null)
  })
  it('a badge folding a record the held proposal changes shows core\'s change glyphs and is marked; one with none shows no glyph (final review 00004 #3)', () => {
    const card = golden('european').model!.cards.find((c) => c.badge !== null)!
    const marked = render(<ViewCard card={{ ...card, badge: { ...card.badge!, proposed: true, change: '+ ↻' } }} />).container
    expect(marked.querySelector(`[data-view="${card.id}.badge.change"]`)?.textContent).toBe('+ ↻')
    expect(badgeButton(marked, card.id)?.getAttribute('data-proposed')).toBe('true')
    marked.remove()
    const plain = render(<ViewCard card={{ ...card, badge: { ...card.badge!, proposed: false, change: '' } }} />).container
    expect(plain.querySelector(`[data-view="${card.id}.badge.change"]`)).toBeNull()
    expect(badgeButton(plain, card.id)?.hasAttribute('data-proposed')).toBe(false)
  })
  it('DL 7 Nov: the face names what is folded in core\'s `words` with core\'s `icon` (glyphs, no count); without both, core\'s `text` alone', () => {
    const card = golden('european').model!.cards.find((c) => c.badge !== null)!
    // A core before `face` (91fdf8a9), as it sent a named badge.
    const named = render(<ViewCard card={{ ...card, badge: { ...plainBadge(card.badge!), icon: '○', words: '1 open question' } as never }} />).container
    const btn = named.querySelector(`[data-view="${card.id}.badge.words"]`)!.closest('button')!
    expect(named.querySelector(`[data-view="${card.id}.badge.words"]`)?.textContent).toBe('1 open question')
    const icon = named.querySelector(`[data-view="${card.id}.badge.icon"]`)!
    expect([icon.textContent, icon.getAttribute('aria-hidden')]).toEqual(['○', 'true'])
    expect(named.querySelector(`[data-view="${card.id}.badge.text"]`)).toBeNull() // core's count is said once, in its words
    expect(btn.textContent?.startsWith('○1 open question')).toBe(true)
    expect(btn.getAttribute('aria-label')).toBe(card.badge!.label)
    named.remove()
    for (const half of [{ words: '1 open question' }, { icon: '○' }, {}]) {
      const bare = render(<ViewCard card={{ ...card, badge: { ...plainBadge(card.badge!), ...half } as never }} />).container
      expect(bare.querySelector(`[data-view="${card.id}.badge.words"]`)).toBeNull()
      expect(bare.querySelector(`[data-view="${card.id}.badge.text"]`)?.textContent).toBe(card.badge!.text)
      bare.remove()
    }
  })
  it('V11 card (strategy session’s rule): a named badge (core’s icon and words) is visible at rest as the first signal in the marks band, its count said once (FIXTURE of core n2c’s shape)', () => {
    const card = golden('european').model!.cards.find((c) => c.badge !== null)!
    const el = render(<ViewCard card={{ ...card, badge: { ...plainBadge(card.badge!), icon: 'FIXTURE: ○', words: 'FIXTURE: 1 open question' } as never }} selected={false} />).container
    const band = el.querySelector('[data-slot="marks"]')!
    const badge = band.firstElementChild as HTMLElement
    expect(badge.getAttribute('data-badge-at-rest')).toBe(card.id)
    expect(badge.querySelector(`[data-view="${card.id}.badge.words"]`)!.textContent).toBe('FIXTURE: 1 open question')
    expect(badge.querySelector(`[data-view="${card.id}.badge.icon"]`)!.getAttribute('aria-hidden')).toBe('true')
    expect(badge.querySelector(`[data-view="${card.id}.badge.icon"]`)!.textContent).toBe('FIXTURE: ○')
    expect(badge.querySelector(`[data-view="${card.id}.badge.text"]`)).toBeNull()
    expect(badge.closest('.invisible')).toBeNull()
    expect(badge.querySelector('button')!.getAttribute('aria-label')).toBe(card.badge!.label)
    // Shown once: not a second time in the hover line.
    expect(el.querySelectorAll(`[data-view="${card.id}.badge.words"]`)).toHaveLength(1)
  })

  it('DL 7 Nov: unselected, a badge core names in words is on the face at rest, its words visible; one with glyphs only is at rest too (DL 9 Nov: the face never changes height on hover)', () => {
    const card = golden('european').model!.cards.find((c) => c.badge !== null)!
    const rest = render(<ViewCard card={{ ...card, badge: { ...plainBadge(card.badge!), icon: '○', words: '1 open question' } as never }} selected={false} />).container
    const words = rest.querySelector<HTMLElement>(`[data-view="${card.id}.badge.words"]`)!
    expect(words.textContent).toBe('1 open question')
    expect(words.closest('[data-at-rest-hidden]')).toBeNull()
    expect(words.closest('.invisible')).toBeNull()
    expect(words.closest(`[data-badge-at-rest="${card.id}"]`)?.className).toContain('text-[12px]')
    rest.remove()
    const glyphs = render(<ViewCard card={{ ...card, badge: plainBadge(card.badge!) }} selected={false} />).container
    const text = glyphs.querySelector(`[data-view="${card.id}.badge.text"]`)!
    expect([text.closest(`[data-badge-at-rest="${card.id}"]`) !== null, text.closest('.invisible')]).toEqual([true, null])
  })

  it('core\'s badge face (91fdf8a9, DL 10 Nov): every closed badge says its face on the card at rest, one 12px line, its words whole on hover; no card holds an invisible line', () => {
    let faced = 0
    for (const n of GOLDEN) for (const card of golden(n).model!.cards) {
      if (card.badge === null || card.badge.open) continue
      const c = render(<ViewCard card={card} selected={false} />).container
      expect(c.querySelector('[data-view-card] .invisible'), `${n} ${card.id}: no invisible line`).toBeNull()
      // The R2 witness boards are Views from a core before `face`; the rest of this row is about core's face.
      if (!card.badge.face) { c.remove(); continue }
      const face = c.querySelector<HTMLElement>(`[data-view="${card.id}.badge.face"]`)!
      expect(face?.textContent, `${n} ${card.id}`).toBe(card.badge.face)
      expect(face.closest(`[data-badge-at-rest="${card.id}"]`)?.className, `${n} ${card.id} at rest, 12px`).toContain('text-[12px]')
      expect(face.closest('.whitespace-nowrap'), `${n} ${card.id} one line`).not.toBeNull()
      expect(face.closest('button')!.getAttribute('title')!.startsWith(card.badge.words), `${n} ${card.id} words on hover`).toBe(true)
      faced += 1
      c.remove()
    }
    expect(faced).toBeGreaterThan(20)
  })
})

describe('the compact face (Paul 4 Nov: the causal graph reads; every word of core\'s still reachable)', () => {
  const ON_FACE = /^[^.]+\.(glyph|heading|olumi(\.glyph)?|change(\.glyph)?|figure\..*|values\.\d+\.(text|if_approved\.glyph)|rows\..*|badge.*|bound\..*|author\.text|unused|face\.(title|line)\.text|headline\.text)$/ // values: the figure's per-option rows (R3 pristine) and core's R5 mark beside each
  // `bound.*` is on the face since DL 6 Nov (an aim's target is never hidden behind a selection); The rest opens on selection.
  const MORE = /^[^.]+\.(status|reason|premises\..*)$/
  for (const n of GOLDEN) {
    it(`${n}: unselected, a card shows only its glyph, heading, marks, figure and rows (an assumption its reason); the rest opens on selection`, () => {
      for (const card of golden(n).model!.cards) {
        const face = render(<ViewCard card={card} />).container
        for (const el of face.querySelectorAll<HTMLElement>('[data-view]')) {
          const p = el.dataset['view']!, hidden = el.closest('[hidden]') !== null
          // An assumption or condition (no figure, no rows) says what it holds in its reason: on the face, whole on hover.
          const says = card.figure === null && card.rows.length === 0 && p === `${card.id}.reason`
          if (says) expect([hidden, el.closest('[title]')?.getAttribute('title')], `${p} on the face`).toEqual([false, card.reason]) // whole on hover, on the reason's line (Disclosed)
          // A proposed addition's change words are its sr-only caption on the face; a changed card's open with its other words (ViewCardNode).
          else if (p === `${card.id}.change.title`) expect(hidden, `${p} ${card.change!.kind}`).toBe(card.change!.kind === 'changed')
          else if (MORE.test(p)) expect(hidden, `${p} folded`).toBe(true)
          // DL ruling 9 Nov (the face never changes height on hover, focus or opening): a person's author, and an option's (a route's) face
          // line, open with the card beside it; Olumi's author stays on the face at rest (by core's author.by, never its words).
          else if ((p === `${card.id}.author.text` && card.author!.by !== 'olumi') || (p === `${card.id}.face.line.text` && card.family === 'option')) expect(hidden, `${p} opens with the card`).toBe(true)
          // Core's option face (card-face, 8 Nov): an option with core's headline says that one line on the face; its rows open with it. A
          // headline core marks `shared` (every option the same) is the panel's to say once (J1 step 3): the rows stay on the face.
          else if (card.family === 'option' && card.headline != null && card.headline.text !== '' && card.headline.shared !== true && p === `${card.id}.headline.text`) expect(hidden, `${p} on the face`).toBe(false)
          else if (card.family === 'option' && card.headline != null && card.headline.text !== '' && card.headline.shared !== true && p.startsWith(`${card.id}.rows.`)) expect(hidden, `${p} opens with the card`).toBe(true)
          else expect(ON_FACE.test(p) && !hidden, `${p} on the face`).toBe(true)
        }
        const open = render(<ViewCard card={card} selected />).container
        expect(open.querySelector('[hidden]'), `${card.id} opened`).toBeNull()
      }
    })
  }
})

describe('the original card\'s look and its named places (DL 4 Nov: an improved version of Paul\'s original UI)', () => {
  const model = golden('european').model!
  it('every card keeps the marks row and the bottom-right corner; an option its driver corner and outcome band; a figure the place beside its value', () => {
    for (const card of model.cards) {
      const c = render(<ViewCard card={card} />).container
      const slots = [...c.querySelectorAll<HTMLElement>('[data-slot]')].map((e) => e.dataset['slot'])
      expect(slots, card.id).toEqual(expect.arrayContaining(['title-mark', 'marks', 'olumi-badge']))
      expect(slots.includes('driver-badge') && slots.includes('outcome-band'), `${card.id} option places`).toBe(card.family === 'option' && card.rows.length > 0)
      expect(slots.includes('figure-side') && slots.includes('values-band'), `${card.id} figure places`).toBe(card.figure !== null)
      // V11 card: core's named badge sits at rest as the first signal in the marks band, then core's provenance label (J1 step 3); every other place is empty.
      const filled = [...c.querySelectorAll<HTMLElement>('[data-slot]')].filter((e) => [...e.children].some((k) => !k.hasAttribute('data-badge-at-rest') && !k.hasAttribute('data-provenance')) || (e.childElementCount === 0 && e.textContent !== ''))
      expect(filled.map((e) => e.dataset['slot']), `${card.id} places are empty`).toEqual([])
      expect(c.querySelector('[data-view-card]')!.getAttribute('data-slot-outline')).toBe('next-step')
    }
  })
  it('an option the team committed to says who in the marks row, when on hover (olumi.view/3 `committed`); an option without one says nothing', () => {
    const option = golden('european').model!.cards.find((c) => c.family === 'option')!
    // Without its badge and its provenance label (V11 draws both in the same marks band), so the row reads the commitment alone.
    const c = render(<ViewCard card={{ ...option, badge: null, author: undefined, committed: { by: 'Bea', at: '2026-11-04T10:00:00Z' } }} />).container
    const marks = c.querySelector('[data-slot="marks"]')!
    expect(marks.querySelector(`[data-view="${option.id}.committed.by"]`)?.textContent).toBe('Bea')
    expect(marks.textContent).toBe('Committed by: Bea')
    expect(marks.querySelector(`[data-committed="${option.id}"]`)?.getAttribute('title')).toBe('Committed by: Bea · 2026-11-04T10:00:00Z')
    // CONTRAST: core's null draws an empty marks row
    expect(render(<ViewCard card={{ ...option, badge: null, author: undefined, committed: null }} />).container.querySelector('[data-slot="marks"]')!.childElementCount).toBe(0)
  })
  // Re-baselined (DL 8 Nov, V11 audit: the prototype draws no card codes): the face carries no O1/F1 code, and a figure card's per-option
  // row names its option by core's heading instead of the code it pointed at.
  it('no card code on any face; a figure card\'s per-option rows name each option by core\'s heading, in core\'s order', async () => {
    const { useViewStore } = await import('../store')
    for (const n of ['european', 'pricing', 'capacity-v3']) {
      const view = golden(n), cards = view.model!.cards
      useViewStore.setState({ view })
      for (const card of cards) {
        const c = render(<ViewCard card={card} />).container
        expect(c.querySelector('[data-card-number]'), `${n} ${card.id}`).toBeNull()
        expect(c.querySelector(`[data-view-title="${card.id}"]`)!.textContent, `${n} ${card.id}`).not.toMatch(/^\s*(O|F|OC|R|C|A)\d+\s/)
        if (card.values !== null && card.values.length > 1) {
          const named = [...c.querySelectorAll('[data-value-option]')].map((e) => [e.getAttribute('data-value-option'), e.textContent])
          expect(named, `${n} ${card.id}`).toEqual(card.values.map((v) => [v.option, cards.find((x) => x.id === v.option)!.heading]))
        }
        c.remove()
      }
    }
    useViewStore.setState({ view: null })
  })
})
