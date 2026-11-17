/**
 * The two node faces this lane adds to the Simple canvas: a kept idea (Olumi's corner mark, the provenance on hover) and the folded inputs'
 * group (the count, opening in place). The words on them are core's (the idea's own text) or fixed notation chrome (the count).
 */
import { Sparkles } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { KeptIdea } from './keptIdeas'
import { setInputsOpen } from './foldStore'

export const VIEW_IDEA = 'viewIdea', VIEW_FOLD = 'viewFold'
export const IDEA_H = 60, FOLD_H = 44
/** The board's own type scale (ViewCanvas sets `--o-s` on every node, layout.ts simpleScaleOf): 12 px at the board's scale, 18 px lines, the idea's whole text and no clamp (R4, R6). */
const BOARD_TEXT = { fontSize: 'calc(12px * var(--o-s, 1))', lineHeight: 1.5 } as const

/** Fixed notation words: who an idea is from and who kept it. The person's name is core's. */
export const ideaProvenance = (i: KeptIdea): string => `${i.olumis ? "Olumi's idea" : 'An idea'}${i.keptBy === null ? '' : ` · kept by ${i.keptBy.name}`}`

export function IdeaCard({ data }: NodeProps) {
  const { idea, width } = data as { idea: KeptIdea; width: number }
  return (
    <div data-view-idea={idea.id} data-testid="view-idea-card" title={`${ideaProvenance(idea)}\n${idea.text}`}
      className="relative rounded-md border border-panel-border bg-panel px-3 py-2 text-text-body" style={{ width, minHeight: IDEA_H, boxSizing: 'border-box', ...BOARD_TEXT }}>
      {idea.olumis ? <span data-idea-mark="olumi" aria-label="Olumi's idea" role="img" className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-panel border border-panel-border"><Sparkles size={10} style={{ color: 'var(--semantic-info)' }} aria-hidden="true" /></span> : null}
      <span className="block break-words">{idea.text}</span>
    </div>
  )
}

export function FoldCard({ data }: NodeProps) {
  const { count, sid, width } = data as { count: number; sid: string | null; width: number }
  return (
    <button type="button" data-testid="view-inputs-fold" aria-expanded={false} onClick={() => { if (sid !== null) setInputsOpen(sid, true) }}
      title="Show these inputs in place" className="rounded-md border border-panel-border bg-panel text-text-light hover:text-text-body" style={{ width, minHeight: FOLD_H, boxSizing: 'border-box', ...BOARD_TEXT }}>
      {count} inputs
    </button>
  )
}
