/**
 * PL-1083 (1): the rest position of a held proposal's reading rows, measured on the 12:15Z layout of 452caf7a's held cut13 proposal at 1232
 * (pinned box 348 px tall, actions 116 px, two rows). Boxes are stubbed (jsdom has no layout); the rule is checked, not the browser.
 */
import { describe, expect, it } from 'vitest'
import { readingsRest, restTop } from '../readingsRest'

const at = (el: HTMLElement, top: number, height: number) => { el.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect; return el }
const setup = (scrollTop: number, rows: Array<[number, number]>) => {
  const box = document.createElement('div'), root = document.createElement('div'), foot = document.createElement('div')
  Object.defineProperty(box, 'clientHeight', { value: 348 }); Object.defineProperty(box, 'clientTop', { value: 0 }); box.scrollTop = scrollTop
  at(box, 248, 350); at(foot, 0, 116)
  // Row positions are given in scroll coordinates; on screen they sit at box top + y - scrollTop.
  for (const [y, h] of rows) { const r = document.createElement('fieldset'); r.setAttribute('data-reading-row', ''); at(r, 248 + y - scrollTop, h); root.append(r) }
  return { box, root, foot }
}

describe('readingsRest', () => {
  it('both rows whole above the actions: the range runs from the last row clear of the foot to the first row\'s top', () => {
    const { box, root, foot } = setup(0, [[300, 100], [408, 90]])
    expect(readingsRest(box, root, foot)).toEqual({ low: 498 + 8 + 116 - 348, high: 292, rows: 2, short: -18 })
    expect(restTop(0, readingsRest(box, root, foot)!, 900)).toBe(274) // the least move from rest that clears the foot
  })
  it('the range does not depend on where the box is scrolled now', () => {
    const a = setup(0, [[300, 100], [408, 90]]), b = setup(150, [[300, 100], [408, 90]])
    expect(readingsRest(b.box, b.root, b.foot)).toEqual(readingsRest(a.box, a.root, a.foot))
  })
  it('already in range: no move', () => {
    const { box, root, foot } = setup(0, [[300, 100], [408, 90]])
    expect(restTop(280, readingsRest(box, root, foot)!, 900)).toBe(280)
  })
  it('13:50Z on 7163b55b, long words: the second row does not fit, so the first rests whole above the actions; `short` is what all would need', () => {
    const { box, root, foot } = setup(0, [[300, 200], [508, 215]])
    const r = readingsRest(box, root, foot)!
    expect(r).toEqual({ low: 500 + 8 + 116 - 348, high: 292, rows: 1, short: 723 + 8 + 116 - 348 - 292 })
    expect(restTop(0, r, 900)).toBe(276)
  })
  it('the first row fits only without its gap: it gives the gap up and still rests whole', () => {
    const { box, root, foot } = setup(0, [[300, 228], [536, 100]])
    const r = readingsRest(box, root, foot)!
    expect([r.low, r.high, r.rows]).toEqual([528 + 116 - 348, 300, 1])
  })
  it('not even the first row fits: the first row\'s top, never past it; no row is said to rest whole', () => {
    const { box, root, foot } = setup(0, [[300, 238], [546, 215]])
    const r = readingsRest(box, root, foot)!
    expect([r.low, r.high, r.rows]).toEqual([292, 292, 0])
    expect(r.short).toBeGreaterThan(0)
    expect(restTop(0, r, 900)).toBe(292)
  })
  it('CONTRAST: no reading row held: nothing to place', () => {
    const { box, root, foot } = setup(0, [])
    expect(readingsRest(box, root, foot)).toBeNull()
  })
  it('never past the end of the box\'s scroll, never below 0', () => {
    expect(restTop(0, { low: 500, high: 600 }, 420)).toBe(420)
    expect(restTop(0, { low: -40, high: -8 }, 420)).toBe(0)
  })
})

describe('PL-1083 (1), new look, DL 12:5xZ (A), contract 3: what yields while the OPEN review holds readings', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (sel: string) => { const i = css.indexOf(sel + ' {'); return i < 0 ? null : css.slice(i, css.indexOf('}', i) + 1) }
  const HELD_OPEN = ':has(.ok-pinned [data-review-body]:not([hidden]) [data-reading-row])'
  it('first More ways hides (review open)', () => expect(rule("[data-testid='view-chat']" + HELD_OPEN + " > [data-testid='view-more-ways']")).toMatch(/display: none/))
  it('then the thread may shrink below its floor (review open)', () => expect(rule("[data-testid='view-chat']" + HELD_OPEN + ' > [data-thread-wrap]')).toMatch(/min-height: 0/))
  it('the box shrinks rather than run past the composer (review open)', () => expect(rule('.ok-pinned:has([data-review-body]:not([hidden]) [data-reading-row])')).toMatch(/flex-shrink: 1/))
  it('CONTRAST: every such rule is keyed on a held reading row, so nothing changes when none is held', () => {
    const lines = css.split('\n').filter((l) => /view-more-ways|data-thread-wrap/.test(l) && l.includes('{'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toContain(HELD_OPEN)
  })
  // CATCH (fails on 41354eb1: its rules were `:has(.ok-pinned [data-reading-row])` / `.ok-pinned:has([data-reading-row])`, no open-review condition):
  // a held reading row inside a CLOSED review moves nothing, so the thread and More ways keep their room at rest.
  it('CATCH: no rule keys on a held row without the review being open', () => {
    const keyed = css.split('\n').filter((l) => l.includes('[data-reading-row]') && l.includes('{'))
    expect(keyed.length).toBe(3)
    for (const line of keyed) expect(line).toContain('[data-review-body]:not([hidden]) [data-reading-row]')
    expect(css).not.toMatch(/\.ok-pinned \[data-reading-row\]/)
    expect(css).not.toMatch(/\.ok-pinned:has\(\[data-reading-row\]\)/)
  })
  it('CATCH: the open review is a sibling rule only for the pinned box (nothing outside .ok-pinned matches)', () => {
    for (const line of css.split('\n').filter((l) => l.includes('[data-review-body]:not([hidden]) [data-reading-row]'))) expect(line).toContain('.ok-pinned')
  })
})

describe('contract 3: the pending review is one row at rest, and a withheld card says why (source bound by identity)', async () => {
  const { readFileSync } = await import('node:fs')
  const chat = readFileSync('src/olumiView/ViewChat.tsx', 'utf8')
  const card = readFileSync('src/olumiView/previous/CoreCard.tsx', 'utf8')
  const from = chat.indexOf('export function ProposalReview(')
  const approve = chat.slice(from, chat.indexOf('data-step={step.kind}', from))
  // CATCH (fails on 41354eb1: the approve step was the generic section with a "Next step" header and the Proposal drawn open).
  it('CATCH: approve renders a closed review row (a button, aria-expanded) whose words are core\'s heading and on, no header', () => {
    expect(approve).toContain('data-step="approve"')
    expect(approve).toContain('data-testid="view-proposal-review"')
    expect(approve).toContain('data-testid="view-proposal-row"')
    expect(approve).toContain('const [open, setOpen] = useState(false)') // closed at rest
    expect(approve).toContain('aria-expanded={open}')
    expect(approve).toContain('hidden={!open}')
    expect(approve).toContain('data-view="proposal.heading">{p.heading}')
    expect(approve).toContain('data-view="proposal.on">{p.on}')
    expect(approve).not.toContain('Next step</p>')
    expect(approve).toContain('{NEXT_STEP_WORDS.approve}')
    expect(approve).toContain('inRow')
  })
  it('CATCH: inside the review the proposal does not draw its own heading again (it is the row's own words)', () => {
    const inRow = chat.indexOf('{inRow ?'), heading = chat.indexOf('data-view="proposal.heading"', inRow)
    expect(inRow).toBeGreaterThan(0)
    const other = chat.indexOf('\n        : <div>', inRow) // the not-inRow branch
    expect(other).toBeGreaterThan(inRow)
    expect(chat.slice(inRow, other)).not.toContain('proposal.heading') // the heading sits only in the not-inRow branch
    expect(heading).toBeGreaterThan(other)
  })
  it('CATCH: the readings are not placed while the review is closed, and the box keeps its own height', () => {
    expect(chat).toContain("const review = el.closest<HTMLElement>('[data-review-body]')")
    expect(chat).toContain("if (review !== null && review.hidden) { box.style.maxHeight = ''; return }")
    // the closed-guard precedes the placement that reads the actions
    expect(chat.indexOf('review.hidden)')).toBeLessThan(chat.indexOf('[data-testid="view-proposal-actions"]\')', chat.indexOf('review.hidden)')))
  })
  it('CATCH: the pinned box lost its 112 px floor, so a one-row review does not reserve a taller box', () => {
    expect(chat).toContain('<div className="ok-pinned shrink-0 overflow-y-auto" data-testid="view-chat-pinned">')
    expect(chat).not.toContain('min-h-[112px]')
  })
  it('CATCH: a withheld option card says core\'s why, else title, else text, and names the field in data-view', () => {
    expect(card).toContain("export function withheldField(h: NonNullable<ViewCard['headline']>): 'why' | 'title' | 'text' | null {")
    expect(card).toContain("if (h.state !== 'none') return null")
    expect(card).toContain("return (h.why ?? '') !== '' ? 'why' : h.title !== '' ? 'title' : 'text'")
    expect(card).toContain("return f === null ? null : f === 'why' ? h.why! : h[f]")
    expect(card).toContain('return withheldWords(card.headline) ?? card.headline.text')
    expect(card).toContain('data-view={`${id}.headline.${withheldField(h)}`}>{withheldWords(h)}</span>')
    // The withheld pill's words are withheldWords(h) (above); the fixed face's pill still draws core's h.text, so the source is not searched for it.
  })
  it('CATCH: "Why not" is not drawn for a withheld chance: core\'s why, where it sends one, is the pill\'s words (olumiLook L2b binds it drawn)', () => {
    expect(card).not.toContain('<details className="ok-why nodrag nowheel" data-view={`${id}.headline.why`}><summary>Why not</summary><p>{h.why}</p></details>')
  })
  it('CONTRAST: the other next-step kinds keep the "Next step" header and the bordered card', () => {
    expect(chat).toContain('<p className={typography.panelHeader}>Next step</p>')
    expect(chat).toContain('data-step={step.kind} aria-label="Next step"')
  })
})
