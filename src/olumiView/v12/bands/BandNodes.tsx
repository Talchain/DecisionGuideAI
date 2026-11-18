/**
 * The node faces this lane adds to the Simple canvas: a kept idea (Olumi's corner mark, the provenance on hover), the folded inputs' group (the count,
 * opening in place) and a row's group card (D1, groups.ts: Olumi's unreviewed proposals, or the approved notes; the count, whose they are and their
 * kinds as markers, opening in place for the session). The words on them are core's (the idea's own text, Olumi's "Proposed by Olumi", the grouped
 * proposal mark `proposal.changes[].olumi.title`, the grouped cards' headings on hover) or the product's existing chrome (the count, "N notes").
 */
import { OkIcon } from '../../look/icons'
import type { NodeProps } from '@xyflow/react'
import type { NodeType } from '../../../canvas/domain/nodes'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import type { KeptIdea } from './keptIdeas'
import { firstDraft, type CardKindName } from '../fields/fields'
import { useViewStore } from '../../store'
import { OlumiMark } from '../cards/marks'
import { setGroupOpen, setInputsOpen } from './foldStore'
import { ReplyBlocks, replyWordsOf } from '../../EarlyAnswer'
import type { GroupKind } from './groups'

export const VIEW_IDEA = 'viewIdea', VIEW_FOLD = 'viewFold'
export const IDEA_H = 60, FOLD_H = 44
/** The board's own type scale (ViewCanvas sets `--o-s` on every node, layout.ts simpleScaleOf): 12 px at the board's scale, 18 px lines, the idea's whole text and no clamp (R4, R6). */
const BOARD_TEXT = { fontSize: 'calc(12px * var(--o-s, 1))', lineHeight: 1.5 } as const
/** The product's own count of notes (canvas/nodes/shared/NodeNotesMark). */
export const notesCount = (n: number): string => `${n} ${n === 1 ? 'note' : 'notes'}`
/** A grouped kind's marker: the design system's shape for it (cards/kind.ts dsKindOf), a note outlined and dashed as an assumption is. */
const MARKER: Readonly<Record<CardKindName, { kind: NodeType; dashed: boolean }>> = {
  driver: { kind: 'factor', dashed: false }, result: { kind: 'outcome', dashed: false }, risk: { kind: 'risk', dashed: false }, note: { kind: 'factor', dashed: true },
  option: { kind: 'option', dashed: false }, aim: { kind: 'goal', dashed: false }, position: { kind: 'factor', dashed: false },
}

/** Fixed notation words: who an idea is from and who kept it. The person's name is core's. */
export const ideaProvenance = (i: KeptIdea): string => `${i.olumis ? "Olumi's idea" : 'An idea'}${i.keptBy === null ? '' : ` · kept by ${i.keptBy.name}`}`

export function IdeaCard({ data }: NodeProps) {
  const { idea, width } = data as { idea: KeptIdea; width: number }
  return (
    <div data-view-idea={idea.id} data-testid="view-idea-card" title={`${ideaProvenance(idea)}\n${replyWordsOf(idea.text)}`}
      className="relative rounded-md border border-panel-border bg-panel px-3 py-2 text-text-body" style={{ width, minHeight: IDEA_H, boxSizing: 'border-box', ...BOARD_TEXT }}>
      {idea.olumis ? <span data-idea-mark="olumi" aria-label="Olumi's idea" role="img" className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-panel border border-panel-border"><OkIcon id="olumi-mark" size={14} decorative /></span> : null}
      {/* The kept words as the conversation draws the reply they came from (DL, pair v3: the card showed `**` and "## " raw), at the board's type size. */}
      <div className="space-y-1 break-words" data-testid="view-idea-text"><ReplyBlocks text={idea.text} /></div>
    </div>
  )
}

type GroupData = { id: string; kind: GroupKind; kinds: readonly CardKindName[]; words: string | null; hover: string; challenged: number }
/** Said on a folded group that holds a challenge (groups.ts challengedIn). */
export const groupChallenged = (n: number): string => `${n} challenged inside`
/** D1c's count (Codex UI reviewer 008 v8: neutral words, not "not sized yet"); each card says its own state once its row is opened. */
export const olumiMore = (n: number): string => `${n} more from Olumi`

export function FoldCard({ data }: NodeProps) {
  const { count, sid, width, group } = data as { count: number; sid: string | null; width: number; group?: GroupData }
  const firstDraftNow = useViewStore((s) => s.view !== null && firstDraft(s.view).firstDraft === true)
  if (group !== undefined) {
    // D1: one press opens the row's group in place for this visit; the grouped cards' headings are the hover. Olumi's group is framed in Olumi's blue, dashed
    // (a proposal not yet the person's) inside an approved model; on a first draft everything is proposed, so nothing is marked for it (R3); the notes stack
    // in the panel's border.
    const proposed = group.kind === 'proposed', marked = proposed && !firstDraftNow, olumis = group.kind === 'olumi'
    return (
      <button type="button" data-testid="view-group-card" data-group={group.id} data-group-kind={group.kind} data-group-count={count} aria-expanded={false}
        onClick={() => { if (sid !== null) setGroupOpen(sid, group.id) }} title={group.hover}
        className={`flex items-center gap-1.5 rounded-md border bg-panel px-3 text-left text-text-body hover:text-text-header ${marked ? 'border-dashed border-info' : 'border-panel-border'}`}
        style={{ width, minHeight: FOLD_H, boxSizing: 'border-box', ...BOARD_TEXT }}>
        {proposed || olumis ? <OlumiMark words={group.words} /> : null}
        <span className="font-medium tabular-nums text-text-header">{proposed ? count : olumis ? olumiMore(count) : notesCount(count)}</span>
        {proposed && group.words !== null ? <span className="min-w-0 truncate">{group.words}</span> : null}
        {group.challenged > 0 ? <span role="img" data-group-challenged={group.challenged} aria-label={groupChallenged(group.challenged)} title={groupChallenged(group.challenged)} className="inline-flex flex-none"><OkIcon id="challenged" size={14} decorative className="[&>svg]:h-[calc(14px*var(--o-s,1))] [&>svg]:w-[calc(14px*var(--o-s,1))]" /></span> : null}
        <span className="ml-auto flex flex-none items-center gap-1" aria-hidden="true" data-group-kinds={group.kinds.join(' ')}>
          {group.kinds.map((k) => <span key={k} className="inline-flex" style={{ width: 'calc(10px * var(--o-s, 1))', height: 'calc(10px * var(--o-s, 1))' }}><NodeShapeIndicator nodeKind={MARKER[k].kind} dashedOutline={MARKER[k].dashed} size={12} className="h-full w-full" /></span>)}
        </span>
      </button>
    )
  }
  return (
    <button type="button" data-testid="view-inputs-fold" data-group-count={count} aria-expanded={false} onClick={() => { if (sid !== null) setInputsOpen(sid, true) }}
      title="Show these inputs in place" className="rounded-md border border-panel-border bg-panel text-text-light hover:text-text-body" style={{ width, minHeight: FOLD_H, boxSizing: 'border-box', ...BOARD_TEXT }}>
      {count} inputs
    </button>
  )
}
