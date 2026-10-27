import { memo } from 'react'
import { NotebookPen } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import { PROVENANCE_ICON_SIZE_CLASSES } from '../../domain/valueProvenanceIcon'
import { noteLine, useNoteRecords } from '../../domain/noteRecords'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { BottomCardMark } from './CardMark'

/**
 * The card's notes (Paul, 24 Oct 2026, the card icon row: notes are a counted glyph in the reasoning-flags slot). Every
 * note anchored on this card; a note that concerns no visible card is anchored on the question card (`noteRecords.ts`),
 * so no note's text is lost. Hover or focus lists them; the accessible name carries every note in full.
 */
export const NodeNotesMark = memo(function NodeNotesMark({ nodeId }: { nodeId: string }) {
  const records = useNoteRecords()
  const notes = [...records.values()].filter((n) => n.anchorId === nodeId)
  if (notes.length === 0) return null
  const lines = notes.map(noteLine)
  const label = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}. ${lines.join(' ')}`
  // In the card's marks band only when there is a note: an empty mark must not register a band (`BottomCardMark`).
  return (
    <BottomCardMark>
      <Tooltip
        asChild
        delay={NODE_TOOLTIP_DELAY_MS}
        content={<ul className="m-0 grid gap-1 p-0 list-none max-w-[320px]">{lines.map((l, i) => <li key={notes[i].id}>{l}</li>)}</ul>}
      >
        <span
          data-testid={`node-notes-${nodeId}`}
          data-node-tooltip="true"
          data-note-count={notes.length}
          role="img"
          tabIndex={0}
          aria-label={label}
          className={`nodrag nopan inline-flex shrink-0 items-center gap-0.5 rounded-sm text-text-light hover:text-info focus:outline-none focus-visible:text-info focus-visible:ring-2 focus-visible:ring-info ${typography.edgeLabel}`}
        >
          <NotebookPen aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
          <span aria-hidden="true">{notes.length}</span>
        </span>
      </Tooltip>
    </BottomCardMark>
  )
})
