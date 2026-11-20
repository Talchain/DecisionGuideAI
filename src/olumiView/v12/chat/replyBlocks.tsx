/** How a reply is drawn: core's words with their cites, folded to a lead and the rest (moved verbatim from ViewChat.tsx). */
import { useState, type ReactNode } from 'react'
import { type ViewTurn } from '../../client'
import { useViewStore } from '../../store'
import { olumiKey } from '../../layout'
import { typography } from '../../../styles/typography'
import { storiesHeadingOf, storiesOf } from '../../k5'
import { approachOf } from '../ideas'
import { FoldChevron } from '../../look/FoldChevron'
import { ITEM_MARK, LEAD_IN, richText } from './richText'
import { replyLineOf, type FirstAnswerLines, type ReplyLine } from './replyLabels'
type Said = NonNullable<ViewTurn['answer']>['answer']

/** How many cites core put in one block of a reply. */
export const citesIn = (parts: Said) => parts.flatMap((p) => ('cite' in p ? [p] : [])).length

/**
 * One block of a reply, in core's parts. Each cite is numbered by its place in the reply (`first` is this block's first number), with core's
 * cite as its hover, verbatim (R5, the look check: a "◦" read as a stray dot). The number is a position, never a word of the UI's own.
 */
export function Words({ parts, at, first = 1 }: { parts: Said; at: string; first?: number }) {
  let n = first
  return (
    <>
      {parts.map((p, i) => ('cite' in p
        ? <sup key={i} className={typography.viewPanelMeta} data-view-cite={`${at}.${i}.cite`} title={p.cite} aria-label={p.cite}>{n++}</sup>
        : <span key={i} data-view={`${at}.${i}.text`}>{p.text}</span>))}
    </>
  )
}

/**
 * A reply's answer in core's own layout (ORDER-UI-NEXT, 13 Nov: the first reply on #/scenario drew as one wall of text). Core's text keeps its
 * line breaks: a blank line is a new paragraph, a line that starts "- " is a list item (drawn as a bullet, the "- " marker dropped), any other
 * line break stays a line break. Words verbatim and in order; citation markers exactly as `Words` draws them, numbered in the same order.
 * Each part keeps its `data-view`; a part split across lines carries `.text` on its first piece and `.text.<k>` on the rest.
 */
type Piece = { kind: 'text'; i: number; k: number; s: string } | { kind: 'cite'; i: number; cite: string }
/** How many list items of a long reply show at rest (contract §2: a lead, then at most three bullets; the rest behind one press). */
export const REST_ITEMS = 3
/** The panel's one 18 px line (contract §2): a newest reply's opening paragraph, only when it is one short sentence's length. */
export const LEAD_WORDS = 20
export const SHOW_WHOLE_FIRST = 'Show the whole first answer'
export const SHOW_WHOLE_REPLY = 'Show the whole reply'
export const SHOW_LESS = 'Show less'
/** A drawn line's plain words (its list marker dropped, whitespace squashed), for `everyLine`; null where it holds a cite (no prose entry does). */
const lineWords = (l: readonly Piece[]): string | null =>
  l.some((x) => x.kind === 'cite') ? null : l.map((x) => (x.kind === 'text' ? x.s : '')).join('').replace(ITEM_MARK, '').replace(/\s+/g, ' ').trim() || null
export function Blocks({ parts, at, first = 1, item, everyLine = false, fold = false, lines: coreLines = null, lead: big = false, under }: { parts: Said; at: string; first?: number; /** A first draft's reply that has a lead: what is drawn FIRST, in the authority position, given the check's own blocks under core's heading to fold (null where the reply ends at the first answer). The first answer follows it as earlier material: core's label, its opening at rest, its later detail one press away. */ under?: (check: ReactNode | null) => ReactNode; /** `item` is offered on a paragraph's lines too, not only a list's (a floor reply: core offers each line of Olumi's prose, words-start CONTRACT 4). */ everyLine?: boolean; /** Core's own label and check heading for this reply (`answer.first_answer`); null: no such lines. */ lines?: FirstAnswerLines | null; /** V12: drawn under a list line, given that line's words when it is plain words (a method reply's own approaches, each kept on its own). */ item?: (words: string) => ReactNode; /** sx-panel (PANEL-SPEC 2): a long reply shows its opening (core's label, if any, then its first paragraph and the first three items of a list that follows it), then one press for the rest; a first draft's check (core's heading line) and all after it always show. Off unless asked (the conversation asks). */ fold?: boolean; /** The newest reply: its opening paragraph is the panel's one 18 px line when it is {@link LEAD_WORDS} words or fewer. */ lead?: boolean }) {
  const [whole, setWhole] = useState(false)
  const lines: Piece[][] = [[]]
  parts.forEach((p, i) => {
    if ('cite' in p) { lines[lines.length - 1]!.push({ kind: 'cite', i, cite: p.cite }); return }
    p.text.split('\n').forEach((s, k) => { if (k > 0) lines.push([]); if (s !== '') lines[lines.length - 1]!.push({ kind: 'text', i, k, s }) })
  })
  // Each cite keeps its number by its place in core's parts, whether or not the blocks before it are folded away (a fold never renumbers).
  const citeNo = new Map<number, number>()
  parts.forEach((p, i) => { if ('cite' in p) citeNo.set(i, first + citeNo.size) })
  // `strip`: the line's own marker, which is layout, not words: a list line's "- ", or a lead-in's two to six hashes (LEAD_IN).
  const draw = (line: Piece[], strip: RegExp | null) => line.map((x, j) => {
    if (x.kind === 'cite') return <sup key={j} className={typography.viewPanelMeta} data-view-cite={`${at}.${x.i}.cite`} title={x.cite} aria-label={x.cite}>{citeNo.get(x.i)}</sup>
    const s = strip !== null && j === 0 ? x.s.replace(strip, '') : x.s
    return <span key={j} data-view={x.k === 0 ? `${at}.${x.i}.text` : `${at}.${x.i}.text.${x.k}`}>{richText(s)}</span>
  })
  const isItem = (line: Piece[]) => line[0]?.kind === 'text' && ITEM_MARK.test(line[0].s)
  // A line core opens with two to six hashes and a space is a lead-in (the reply contract keeps core's markers, 17 Nov): drawn as a quiet heading,
  // the hashes dropped. One hash, or seven, is words, drawn as typed.
  const isLeadIn = (line: Piece[]) => line[0]?.kind === 'text' && LEAD_IN.test(line[0].s)
  // Group: blank lines end a paragraph; consecutive "- " lines make one list; a lead-in stands alone.
  const groups: { list: boolean; leadIn?: boolean; lines: Piece[][] }[] = []
  let breakBefore = true
  for (const line of lines) {
    if (line.length === 0) { breakBefore = true; continue }
    if (isLeadIn(line)) { groups.push({ list: false, leadIn: true, lines: [line] }); breakBefore = true; continue }
    const list = isItem(line), last = groups[groups.length - 1]
    if (!breakBefore && last && !last.leadIn && last.list === list) last.lines.push(line); else groups.push({ list, lines: [line] })
    breakBefore = false
  }
  // How long the reply reads, in lines of the panel (about 44 characters to a line at 12 px): an estimate, never a measure.
  const chars = (l: Piece[]) => l.reduce((n, x) => n + (x.kind === 'text' ? x.s.length : 2), 0)
  const linesIn = (gs: typeof groups) => gs.reduce((n, g) => n + g.lines.reduce((m, l) => m + Math.max(1, Math.ceil(chars(l) / 44)), 0), 0)
  // Core's own label and heading lines, by the words core sent on this turn (replyLabels.ts): drawn apart from the prose, and the label is not
  // counted as one of the two folded blocks.
  const lineOf = (g: { list: boolean; leadIn?: boolean; lines: Piece[][] }): ReplyLine => {
    if (g.list || g.leadIn || g.lines.length !== 1) return null
    const only = g.lines[0]!
    return only.every((x) => x.kind === 'text') ? replyLineOf(only.map((x) => (x.kind === 'text' ? x.s : '')).join(''), coreLines) : null
  }
  const lead = groups.length > 0 && lineOf(groups[0]!) === 'label' ? 1 : 0
  // Olumi's check against the model (core's heading line) and everything after it always show: the fold hides only the first answer's later
  // detail, never the model's check or correction of it (Codex, 16 Nov: a folded reply could show the unverified claim and hide its correction).
  const check = groups.findIndex((g) => lineOf(g) === 'heading')
  const head = check === -1 ? groups.length : check
  // What shows at rest, by group: core's label; the opening (a paragraph whole, or the first three items of a list it opens with); after an
  // opening paragraph, the first three items of a list that follows it. Whole groups and whole list items only: no sentence is ever cut.
  const rest = new Map<number, number>()
  for (let gi = 0; gi < lead; gi++) rest.set(gi, groups[gi]!.lines.length)
  // A lead-in over the opening stays with it (it names what follows).
  let o = lead
  while (o < head && groups[o]!.leadIn) { rest.set(o, 1); o++ }
  const opening = o < head ? groups[o]! : null
  if (opening !== null) {
    rest.set(o, opening.list ? Math.min(REST_ITEMS, opening.lines.length) : opening.lines.length)
    const then = o + 1 < head ? groups[o + 1]! : null
    if (!opening.list && then !== null && then.list) rest.set(o + 1, Math.min(REST_ITEMS, then.lines.length))
  }
  const hides = groups.slice(0, head).some((g, gi) => (rest.get(gi) ?? 0) < g.lines.length)
  // With `under`, the check is drawn short by its lead, so only the first answer's own length decides whether its later detail folds.
  const est = linesIn(under === undefined ? groups : groups.slice(0, head))
  const foldable = fold && hides && est > 8
  const folded = foldable && !whole
  const textOf = (g: { lines: Piece[][] }) => g.lines.flatMap((l) => l.map((x) => (x.kind === 'text' ? x.s : ''))).join(' ')
  // The panel's one 18 px line (contract §2): the newest reply's opening paragraph, only when it is one short sentence's length. Never a paragraph under
  // core's first-answer label (`lead`: the reply opens with that label): core marks that answer as the earlier one, so it is not the panel's largest
  // words above its own check, with or without a lead (a reply stored before leads existed has the label and none). By core's label line, no words read.
  const bigLead = big && lead === 0 && opening !== null && !opening.list && textOf(opening).trim().split(/\s+/).length <= LEAD_WORDS
  const groupEl = (g: { list: boolean; leadIn?: boolean; lines: Piece[][] }, gi: number) => {
    const shown = folded && gi < head ? rest.get(gi) ?? 0 : g.lines.length
    if (shown === 0) return null
    const open = gi === o && opening !== null ? { 'data-reply-opening': '' } : {}
    if (g.leadIn) return <p key={gi} className={`m-0 mt-2 ${typography.viewPanelHeading} text-text-header`} data-reply-lead-in="">{draw(g.lines[0]!, LEAD_IN)}</p>
    return lineOf(g) === 'label'
      ? <p key={gi} className={`m-0 ${typography.viewPanelMeta} text-text-light`} data-reply-label="">{g.lines[0]!.map((x) => (x.kind === 'text' ? x.s : '')).join('')}</p>
      : lineOf(g) === 'heading'
      ? <p key={gi} className={`m-0 mt-2 ${typography.viewPanelHeading} text-text-header`} data-reply-heading="">{g.lines[0]!.map((x) => (x.kind === 'text' ? x.s : '')).join('')}</p>
      : (g.list
      ? <ul key={gi} className="m-0 !list-none !pl-3" data-reply-list="" {...open}>{g.lines.slice(0, shown).map((l, li) => { const w = item === undefined ? null : everyLine ? lineWords(l) : approachOf(l.map((x) => (x.kind === 'cite' ? { cite: x.cite } : { text: x.s }))); return <li key={li} className="group/item relative !mb-1 last:!mb-0 before:absolute before:-left-3 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:!bg-text-light before:content-['']">{draw(l, ITEM_MARK)}{w === null ? null : item!(w)}</li> })}</ul>
      : <p key={gi} className={bigLead && gi === o ? `m-0 ${typography.viewPanelHeadline} text-text-header` : 'm-0'} data-reply-para="" {...open}>{g.lines.map((l, li) => { const w = item === undefined || !everyLine ? null : lineWords(l); return <span key={li} className={w === null ? undefined : 'group/item'}>{li > 0 ? <br /> : null}{draw(l, null)}{w === null ? null : item!(w)}</span> })}</p>)
  }
  return (
    <>
      {/* The CURRENT answer has the authority position (Codex 19:46:53Z, after replay 012: a first answer later found wrong stood large above its
          own correction). With `under`, the caller's lead and the check it folds are drawn FIRST; the first answer follows as earlier material
          under core's own label. Core's check heading opens the folded check; nothing is said twice. */}
      {/* (A heading core sent with nothing after it labels nothing: there is no check to fold, so no fold is drawn for it.) */}
      {under === undefined ? null : under(check === -1 || check + 1 >= groups.length ? null : <>{groups.slice(check).map((g, gi) => groupEl(g, check + gi))}</>)}
      {groups.slice(0, head).map((g, gi) => groupEl(g, gi))}
      {foldable
        ? <button type="button" aria-expanded={!folded} data-testid="view-reply-fold" onClick={() => setWhole(!whole)}
            className={`${typography.viewPanelHeading} inline-flex min-h-[24px] items-center gap-1 self-start text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{folded ? (coreLines === null ? SHOW_WHOLE_REPLY : SHOW_WHOLE_FIRST) : SHOW_LESS}<FoldChevron open={!folded} /></button>
        : null}
      {under === undefined ? groups.slice(head).map((g, gi) => groupEl(g, head + gi)) : null}
    </>
  )
}

/**
 * K5 "If it failed" (R3): the pre-mortem's stories on the reply they came with, under core's heading, each marked Olumi's with the key's
 * own Olumi glyph (`model.key`); the option a story is about and the cards it rests on as label: value lines, in each card's own heading.
 * Every word is core's (./k5.ts, ahead of core); a record that is not a card on the canvas is not named, and nothing is drawn without stories.
 */
export function Stories({ answer, at }: { answer: NonNullable<ViewTurn['answer']>; at: string }) {
  const model = useViewStore((s) => s.view?.model ?? null)
  const stories = storiesOf(answer), heading = storiesHeadingOf(answer)
  if (stories.length === 0 || heading === null) return null
  // Core's key item for Olumi by its id (`olumi`), never its words (DL 4 Nov, R4): the one matcher, layout.ts olumiKey.
  const olumi = model === null ? null : olumiKey(model)
  const headingOf = (id: string) => model?.cards.find((c) => c.id === id)?.heading ?? null
  return (
    <section data-testid="view-chat-stories" aria-label={heading}>
      <p className={`${typography.viewPanelHeading} text-text-header`} data-view={`${at}.answer.stories_heading`}>{heading}</p>
      <ol className="space-y-2">
        {stories.map((st, i) => {
          const option = st.option === null ? null : headingOf(st.option)
          const rests = st.rests_on.flatMap((id) => { const h = headingOf(id); return h === null ? [] : [h] })
          return (
            <li key={i} data-story={i}>
              <p>{olumi === null ? null : <span className="text-info" title={olumi.text} aria-label={olumi.text} data-story-mark="">{olumi.glyph} </span>}<span data-view={`${at}.answer.stories.${i}.text`}>{st.text}</span></p>
              {option === null ? null : <p className={`${typography.chatMeta} text-text-light`} data-story-option="">Option: <span>{option}</span></p>}
              {rests.length === 0 ? null : <p className={`${typography.chatMeta} text-text-light`} data-story-rests="">Rests on: <span>{rests.join(', ')}</span></p>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
