/**
 * THE LANE'S RIGHT-CLICK MENU (V12 manual editing, 16 Nov; MANUAL-EDITING-MAP, reply 002): a pure builder from what was right-clicked and
 * what core currently lets the person do. Every edit row opens the lane's one small form (`olumiView/v12/edit/EditForm.tsx`), which calls the
 * real core route; no row writes through the legacy canvas store, and no row is faked. A row that cannot act is OMITTED (Paul, 19 Nov: "a menu that
 * does nothing new goes"): no Delete or connected card (core has no route), no Rename, Add or Undo while core takes no edit. This reverses the
 * earlier "shown disabled, never absent" rule: each builder returns its row only where it can act, so `tidyDividers` below only tidies the dividers.
 *
 * Nothing here imports a legacy writer (`actions.ts`' graph mutations, `runCanvasUndo`, `handleLayoutWithRecovery`): the builder gets its
 * effects as callbacks, so a spec can say exactly which route each row reaches.
 */
import { createElement } from 'react'
import { NodeShapeIndicator } from '../nodes/NodeShapeIndicator'
import type { DsKind } from '../../olumiView/v12/cards/kind'
import type { IconId } from '../../olumiView/look/icons'
import type { ViewCard, ViewLink, ViewModel } from '../../olumiView/client'
import type { EditGate } from '../../olumiView/v12/edit/editGate'
import { isSizeEdit, type EditSpec } from '../../olumiView/v12/edit/EditForm'
import type { UndoChoice } from '../../olumiView/v12/edit/undo'
import { canRenameCard } from '../../olumiView/v12/edit/renameCard'
import { plainWords } from '../../olumiView/plainWords'
import { isMenuItem, type ContextTarget, type MenuEntry, type MenuItemDef } from './types'

export const LANE_MENU_WORDS = {
  hand: 'Hand mode', select: 'Select mode', add: 'Add', factor: 'Factor', figure: 'Figure', option: 'Option', risk: 'Risk', claim: 'Claim', question: 'Open question',
  askOlumi: 'Ask Olumi', missing: "What's missing from this model?", explain: 'Explain this', challenge: 'Challenge this',
  autoArrange: 'Auto-arrange', whole: 'Show the whole model', simple: 'Simple',
  details: 'Open details', rename: 'Rename', change: 'Change figure', setStrength: 'Set strength', setSize: 'Set chance and size', removeLink: 'Remove link',
  addRisk: 'Add a risk to this', addClaim: 'Add a claim about this',
  // Paul's option menu (5.png, audit F32): three asks that put a question about the card in the AI box for the person to send.
  addOutcome: 'Add outcome from this', cut: 'Cut (ask Olumi)', otherEdits: 'Other model edits: ask Olumi',
} as const

export type AskIntent = 'explain_element' | 'challenge_element' | 'review_model_gaps' | 'explain_subgraph'
export type LaneMenuCtx = {
  readonly gate: EditGate
  readonly model: ViewModel | null
  readonly undo: { readonly undo: UndoChoice; readonly redo: UndoChoice }
  readonly level: 'simple' | 'working'
  readonly mode?: 'select' | 'hand'
  /** The question card's id: it is the person's brief, not a record core renames. */
  readonly questionId: string
  readonly act: {
    readonly open: (spec: EditSpec) => void
    readonly openDetails: (t: { readonly kind: 'card' | 'link'; readonly id: string }) => void
    /** Surfaces step 5 (the lane only; absent on the older look): open the details of a card or link with its Value row's field focused. A figure, a risk's size and a link's strength are changed there and nowhere else. */
    readonly openRename?: (id: string) => void
    readonly openRemove?: (link: ViewLink) => void
    readonly openFigure?: (t: { readonly kind: 'card' | 'link'; readonly id: string }) => void
    readonly ask: (target: ContextTarget, intent: AskIntent) => void
    /** Puts `text` in the AI box for the person to finish and send (the card's Olumi badge does the same); sends nothing. */
    readonly prefill?: (text: string, label: string, targetId: string) => void
    readonly pressUndo: (dir: 'undo' | 'redo') => void
    readonly autoArrange: () => void
    readonly toggleLevel: () => void
    readonly setMode?: (mode: 'select' | 'hand') => void
  }
}

const DIV: MenuEntry = { type: 'divider' }
const figureCards = (m: ViewModel | null): ViewCard[] => (m?.cards ?? []).filter((c) => c.family === 'quantity')

/** The row that changes a figure: on the lane it opens the item's Value row (`openFigure`), the one place that is done; the older look opens the small form for it. Drawn by the same gate. */
function figureRow(c: LaneMenuCtx, id: string, label: string, tooltip: string, at: { readonly kind: 'card' | 'link'; readonly id: string }, spec: (g: Extract<EditGate, { ok: true }>) => EditSpec): MenuItemDef[] {
  const open = c.act.openFigure
  return editRow(c, id, label, 'edit', tooltip, spec, open === undefined ? {} : { action: () => open(at) })
}

/** An edit row, only where core takes an edit now: no row (nothing to read, nothing to press) while it does not. */
function editRow(c: { gate: EditGate; act: Pick<LaneMenuCtx['act'], 'open'> }, id: string, label: string, iconId: IconId | undefined, tooltip: string, spec: (g: Extract<EditGate, { ok: true }>) => EditSpec, extra: Partial<MenuItemDef> = {}): MenuItemDef[] {
  const g = c.gate
  return g.ok ? [{ id, label, ...(iconId === undefined ? {} : { iconId }), tooltip, enabled: true, action: () => c.act.open(spec(g)), ...extra }] : []
}

function kindIcon(nodeKind: DsKind): NonNullable<MenuItemDef['icon']> {
  return ({ size, className }: { size?: number; className?: string }) => createElement(NodeShapeIndicator, { nodeKind, size, className })
}

const ADD_KIND_ICONS = {
  figure: kindIcon('factor'),
  choice: kindIcon('option'),
  risk: kindIcon('risk'),
  claim: kindIcon('factor'),
  question: kindIcon('factor'),
  outcome: kindIcon('outcome'),
}

/** Dividers never lead, trail or double. */
function tidyDividers(entries: ReadonlyArray<MenuEntry>): MenuEntry[] {
  const kept: MenuEntry[] = []
  for (const e of entries) if (isMenuItem(e) || (kept.length > 0 && isMenuItem(kept[kept.length - 1]!))) kept.push(e)
  while (kept.length > 0 && !isMenuItem(kept[kept.length - 1]!)) kept.pop()
  return kept
}

const undoRows = (c: LaneMenuCtx): MenuItemDef[] => {
  const row = (dir: 'undo' | 'redo', shortcut: string): MenuItemDef[] => {
    const x = c.undo[dir]
    if (x.kind === 'none') return []
    // Core's words for what an undo takes back can carry a kept idea's own markdown ("## …"): a menu row is plain text (plainWords).
    const label = plainWords(x.label)
    return [{ id: dir, label, iconId: 'undo', ...(dir === 'redo' ? { iconAlt: true } : {}), shortcut, enabled: true, tooltip: x.note === null ? label : `${label}. ${x.note}`, action: () => c.act.pressUndo(dir) }]
  }
  // A saved edit has one level and no redo in this slice: Redo is drawn only where a dragged card can be put back.
  return [...row('undo', '⌘Z'), ...row('redo', '⌘⇧Z')]
}

const ask = (c: LaneMenuCtx, target: ContextTarget, items: ReadonlyArray<[string, string, AskIntent]>): MenuItemDef => ({
  id: 'ask-olumi', label: LANE_MENU_WORDS.askOlumi, iconId: 'olumi-mark', tooltip: 'Ask Olumi about this', enabled: true, hasSubmenu: true, action: () => undefined,
  submenuItems: items.map(([id, label, intent]) => ({ id, label, iconId: 'olumi-mark', tooltip: label, enabled: true, action: () => c.act.ask(target, intent) })),
})

export function addMenuRows(c: Pick<LaneMenuCtx, 'gate' | 'model'>, open: LaneMenuCtx['act']['open']): MenuItemDef[] {
  const ctx = { gate: c.gate, act: { open } }
  const figures = figureCards(c.model).map((f) => ({ id: f.id, heading: f.heading }))
  const item = (id: string, label: string, kind: 'choice' | 'risk' | 'claim' | 'question', tip: string): MenuItemDef[] =>
    editRow(ctx, id, label, undefined, tip, (g) => ({ kind: 'item', sid: g.sid, base: g.base, item: kind, concerns: [], about: null, pickFigure: kind === 'risk' ? figures : null }),
      { icon: ADD_KIND_ICONS[kind], ...(kind === 'risk' && figures.length === 0 ? { enabled: false, disabledReason: 'Add a figure for this risk to affect.' } : {}) })
  return [
    ...editRow(ctx, 'add-factor', LANE_MENU_WORDS.figure, undefined, 'A figure of your own, with its value', (g) => ({ kind: 'figure-add', sid: g.sid, base: g.base }), { icon: ADD_KIND_ICONS.figure }),
    ...item('add-option', LANE_MENU_WORDS.option, 'choice', 'A route you could take'),
    ...item('add-risk', LANE_MENU_WORDS.risk, 'risk', 'Something that could go wrong, on a figure it would move'),
    ...item('add-claim', LANE_MENU_WORDS.claim, 'claim', 'A statement you hold about this'),
    ...item('add-question', LANE_MENU_WORDS.question, 'question', 'Something no figure or link answers yet'),
  ]
}

function paneMenu(target: Extract<ContextTarget, { kind: 'pane' }>, c: LaneMenuCtx): MenuEntry[] {
  const addItems = addMenuRows(c, c.act.open)
  const add: MenuItemDef[] = addItems.length === 0 ? [] : [{ id: 'add', label: LANE_MENU_WORDS.add, iconId: 'add', tooltip: 'Add to the model in your own words', enabled: true, hasSubmenu: true, action: () => undefined, submenuItems: addItems }]
  return [
    ...(c.mode !== undefined && c.act.setMode !== undefined ? [{
      id: 'interaction-mode', label: c.mode === 'select' ? LANE_MENU_WORDS.hand : LANE_MENU_WORDS.select, iconId: c.mode === 'select' ? 'tool-hand' : 'selected-row', shortcut: c.mode === 'select' ? 'H' : 'V',
      tooltip: c.mode === 'select' ? 'Drag the canvas to move around' : 'Click and drag to select cards', enabled: true, action: () => c.act.setMode!(c.mode === 'select' ? 'hand' : 'select'),
    } satisfies MenuItemDef, DIV] : []),
    ...add,
    ask(c, target, [['ask-missing', LANE_MENU_WORDS.missing, 'review_model_gaps']]),
    DIV, ...undoRows(c), DIV,
    ...((c.model?.cards.length ?? 0) > 0 ? [{ id: 'auto-arrange', label: LANE_MENU_WORDS.autoArrange, iconId: 'layout-grid', shortcut: '⇧A', tooltip: 'Put the cards back in their own places', enabled: true, action: () => c.act.autoArrange() } satisfies MenuItemDef] : []),
    { id: 'toggle-level', label: c.level === 'simple' ? LANE_MENU_WORDS.whole : LANE_MENU_WORDS.simple, iconId: 'level-simple-detailed', tooltip: c.level === 'simple' ? 'Draw every card of the model' : 'Draw only the question, the options and what matters most', enabled: true, action: () => c.act.toggleLevel() },
  ]
}

function nodeMenu(target: Extract<ContextTarget, { kind: 'node' }>, c: LaneMenuCtx): MenuEntry[] {
  const id = target.nodeId, card = c.model?.cards.find((x) => x.id === id) ?? null, isQuestion = id === c.questionId
  const items: MenuEntry[] = [
    { id: 'open-details', label: LANE_MENU_WORDS.details, iconId: 'info-more', tooltip: 'Open the details of this card', enabled: true, action: () => c.act.openDetails({ kind: 'card', id }) },
    ask(c, target, [['ask-explain', LANE_MENU_WORDS.explain, 'explain_element'], ['ask-challenge', LANE_MENU_WORDS.challenge, 'challenge_element']]),
  ]
  const edits: MenuEntry[] = card !== null && !isQuestion ? [...cardEditRows(card, c)] : []
  const prefill = c.act.prefill, name = card?.heading ?? ''
  const asks: MenuEntry[] = card !== null && !isQuestion && prefill !== undefined ? [
    { id: 'ask-add-outcome', label: LANE_MENU_WORDS.addOutcome, icon: ADD_KIND_ICONS.outcome, tooltip: 'Ask Olumi to add an outcome that follows from this', enabled: true, action: () => prefill(`Add an outcome that follows from ${name}: `, LANE_MENU_WORDS.addOutcome, id) },
    { id: 'ask-cut', label: LANE_MENU_WORDS.cut, iconId: 'cut', tooltip: 'Ask Olumi to take this out of the model', enabled: true, action: () => prefill(`Take ${name} out of the model, because `, LANE_MENU_WORDS.cut, id) },
    { id: 'ask-other-edits', label: LANE_MENU_WORDS.otherEdits, iconId: 'olumi-mark', tooltip: 'Ask Olumi for another change to this', enabled: true, action: () => prefill(`About ${name}: `, LANE_MENU_WORDS.otherEdits, id) },
  ] : []
  return [...items, ...(edits.length > 0 ? [DIV, ...edits] : []), ...(asks.length > 0 ? [DIV, ...asks] : [])]
}

/** The edits core takes on one card (rename, its figure or size, a risk or claim about it): the right-click menu's rows and the details panel's buttons. */
export function cardEditRows(card: ViewCard, c: LaneMenuCtx): MenuItemDef[] {
  const edit = card.figure?.edit ?? null, edits: MenuItemDef[] = []
  {
    const rename = c.act.openRename
    if (rename === undefined || canRenameCard(card)) {
      edits.push(...editRow(c, 'rename', LANE_MENU_WORDS.rename, 'edit', 'Give this card your own name',
        (g) => ({ kind: 'rename', sid: g.sid, base: g.base, record: card.id, current: card.heading }),
        rename === undefined ? {} : { action: () => rename(card.id) }))
    }
    if (isSizeEdit(edit)) {
      const link = edit.fields.some((f) => f.key === 'typed')
      edits.push(...figureRow(c, 'size', link ? LANE_MENU_WORDS.setStrength : LANE_MENU_WORDS.setSize, edit.prompt, { kind: 'card', id: card.id }, (g) => ({ kind: 'size', sid: g.sid, base: g.base, edit, subject: card.heading })))
    } else if (edit != null) {
      edits.push(...figureRow(c, 'change-figure', LANE_MENU_WORDS.change, edit.prompt, { kind: 'card', id: card.id }, (g) => ({ kind: 'figure-edit', sid: g.sid, base: g.base, record: card.id, edit })))
    }
    if (card.family === 'quantity') edits.push(...editRow(c, 'add-risk', LANE_MENU_WORDS.addRisk, undefined, 'A risk on this figure', (g) => ({ kind: 'item', sid: g.sid, base: g.base, item: 'risk', concerns: [card.id], about: card.heading, pickFigure: null }), { icon: ADD_KIND_ICONS.risk }))
    edits.push(...editRow(c, 'add-claim', LANE_MENU_WORDS.addClaim, undefined, 'A statement you hold about this', (g) => ({ kind: 'item', sid: g.sid, base: g.base, item: 'claim', concerns: [card.id], about: card.heading, pickFigure: null }), { icon: ADD_KIND_ICONS.claim }))
  }
  return edits
}

/** The edits core takes on one link: its strength (`/size`) and taking it off. */
export function linkEditRows(link: ViewLink | undefined, c: LaneMenuCtx): MenuItemDef[] {
  const size = link?.size?.edit ?? null, remove = link?.remove ?? null, rows: MenuItemDef[] = []
  if (isSizeEdit(size) && link !== undefined) rows.push(...figureRow(c, 'size', LANE_MENU_WORDS.setStrength, size.prompt, { kind: 'link', id: edgeIdOf(link) }, (g) => ({ kind: 'size', sid: g.sid, base: g.base, edit: size, subject: link.size!.text })))
  if (remove !== null && remove !== undefined) rows.push(...editRow(c, 'remove-link', LANE_MENU_WORDS.removeLink, 'remove-link', 'Take this link off the model', (g) => ({ kind: 'remove-link', sid: g.sid, base: g.base, remove }), { destructive: true, ...(c.act.openRemove === undefined || link === undefined ? {} : { action: () => c.act.openRemove?.(link) }) }))
  return rows
}
export const edgeIdOf = (l: Pick<ViewLink, 'from' | 'to' | 'kind'>): string => `${l.from}->${l.to}:${l.kind}`

function edgeMenu(target: Extract<ContextTarget, { kind: 'edge' }>, c: LaneMenuCtx): MenuEntry[] {
  const link = (target.edge as unknown as { data?: { link?: ViewLink } }).data?.link
  const rows = linkEditRows(link, c)
  return [
    ...(link === undefined ? [] : [{ id: 'open-details', label: LANE_MENU_WORDS.details, iconId: 'info-more', tooltip: 'Open the details of this link', enabled: true, action: () => c.act.openDetails({ kind: 'link', id: target.edgeId }) } satisfies MenuItemDef]),
    ask(c, target, [['ask-explain', LANE_MENU_WORDS.explain, 'explain_element']]), ...(rows.length > 0 ? [DIV, ...rows] : [])]
}

export function buildLaneMenu(target: ContextTarget, c: LaneMenuCtx): MenuEntry[] { return tidyDividers(buildAllRows(target, c)) }

function buildAllRows(target: ContextTarget, c: LaneMenuCtx): MenuEntry[] {
  switch (target.kind) {
    case 'pane': return paneMenu(target, c)
    case 'node': return nodeMenu(target, c)
    case 'edge': return edgeMenu(target, c)
    case 'multi': return [ask(c, target, [['ask-explain', LANE_MENU_WORDS.explain, 'explain_subgraph']])]
  }
}
