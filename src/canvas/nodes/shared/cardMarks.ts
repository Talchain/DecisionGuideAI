import {
  LocateFixed, AlertTriangle, AlertCircle, Wrench, GraduationCap, Lightbulb, Flag, Anchor, BadgeHelp, Bookmark, CircleDashed, CircleSlash, Clock, EyeOff, Target, NotebookPen, ListFilter, RotateCcw,
  Gauge, History, HelpCircle, ListOrdered, Grid2x2, ScanLine,
  Signal, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from '../../domain/valueProvenance'
import { UNCONFIRMED_ESTIMATE_LABEL, UNCONFIRMED_ESTIMATE_TOKEN } from '../../domain/vocabulary'
import { VALUE_PROVENANCE_ICON } from '../../domain/valueProvenanceIcon'
import { NOT_RANKED_MARKER } from '../../state/winShareGate'
import { OPTION_RESULT_COPY, FACTOR_NO_ANALYSIS_YET_SHORT } from './metricVocabulary'

export interface CardMarkDefinition {
  readonly id: string
  /** Current card words, verbatim. N/M/… identify variable content, not new copy. */
  readonly words: string
  readonly Icon: LucideIcon
  readonly nodeTypes: readonly string[]
  readonly keyWords?: readonly string[]
  readonly keyText: string
  readonly ariaWords: string
  readonly visual?: CardMarkVisual
  /** Marks rendered on cards or in the board status area. */
  readonly rendered: boolean
}
export type CardMarkVisual = 'level-meter' | 'rank-bar' | 'rank-bar-history' | 'empty-value' | 'risk-matrix' | 'target-dashed'
const values = ['factor', 'option', 'outcome', 'risk', 'goal', 'decision'] as const
function entry<Id extends string>(id: Id, words: string, Icon: LucideIcon, nodeTypes: readonly string[], rendered = false, keyText = words, ariaWords = keyText, visual?: CardMarkVisual): CardMarkDefinition & { readonly id: Id } {
  return { id, words, Icon, nodeTypes, keyText, ariaWords, rendered, visual }
}
/** Whole UI-DESIGN §1a inventory at f01a4427. Content change rows stay content. */
export const CARD_MARKS = [
  entry('share-withheld', NOT_RANKED_MARKER, EyeOff, ['option'], true),
  entry('current-model', OPTION_RESULT_COPY.current, Gauge, ['option']),
  entry('model-result', OPTION_RESULT_COPY.unconfirmed, ScanLine, ['option']),
  entry('compact-model', OPTION_RESULT_COPY.compact, BookOpen, ['option']),
  entry('provisional', OPTION_RESULT_COPY.provisional, BadgeHelp, ['option'], true),
  entry('last-run', OPTION_RESULT_COPY.lastRun, Clock, ['option'], true),
  entry('no-new-comparison', OPTION_RESULT_COPY.lastRunNoNewComparison, RotateCcw, ['option'], true),
  entry('baseline-no-changes', 'Baseline · no changes', Anchor, ['option'], true),
  entry('baseline-option', 'Baseline option', Bookmark, ['option'], true),
  entry('not-analysed', 'Not analysed', CircleSlash, ['option'], true),
  entry('needs-input', 'Needs input', CircleDashed, ['option']),
  entry('source-olumi', UNCONFIRMED_ESTIMATE_TOKEN, VALUE_PROVENANCE_ICON.ai, values, true, UNCONFIRMED_ESTIMATE_TOKEN, `Olumi estimate — ${UNCONFIRMED_ESTIMATE_LABEL.toLowerCase()}`),
  entry('source-unverified_brief', VALUE_PROVENANCE_LABEL.unverified_brief, VALUE_PROVENANCE_ICON.unverified_brief, values, true),
  entry('source-brief', 'brief', VALUE_PROVENANCE_ICON.brief, values, true, 'From your brief'),
  { ...entry('source-you', 'you', VALUE_PROVENANCE_ICON.human, values, true, 'Set by you'), keyWords: ['Set by you', ' · entered'] },
  entry('source-edited', VALUE_PROVENANCE_LABEL.edited, VALUE_PROVENANCE_ICON.edited, values, true),
  entry('source-confirmed', VALUE_PROVENANCE_LABEL.confirmed, VALUE_PROVENANCE_ICON.confirmed, values, true),
  entry('source-panel', 'panel', VALUE_PROVENANCE_ICON.panel, values, true, VALUE_PROVENANCE_LABEL.panel),
  entry('source-unknown', 'no source', HelpCircle, values, true, 'Source not recorded'),
  entry('factor-tier', 'Very low · Low · Medium · High · Very high', Signal, ['factor'], true, undefined, undefined, 'level-meter'),
  entry('driver', 'Driver N of M ranked in this run', ListOrdered, ['factor'], true, 'Driver N of M ranked in this run · Last run · Driver N of M ranked · Driver N of M ranked · no value yet', undefined, 'rank-bar'),
  entry('driver-last-run', 'Last run · Driver N of M ranked', History, ['factor'], true, undefined, undefined, 'rank-bar-history'),
  entry('working-assumption', FACTOR_NO_ANALYSIS_YET_SHORT, BookOpen, ['factor'], true),
  entry('working-assumption-no-analysis', 'Working assumption · no analysis yet', CircleDashed, ['factor']),
  entry('outcome-unquantified', 'Outcome not quantified', Gauge, ['outcome'], true, undefined, undefined, 'empty-value'),
  entry('risk-unset', 'Likelihood and impact not set yet', Grid2x2, ['risk'], true, undefined, undefined, 'risk-matrix'),
  entry('target-not-captured', 'Target not captured', Target, ['goal'], true, undefined, undefined, 'target-dashed'),
  entry('assumptions-open', 'Assumptions open for review', NotebookPen, ['decision'], true),
  entry('attention', 'Worth reviewing: …', LocateFixed, values, true),
  entry('coaching-must-fix', 'Coaching suggestion: …', AlertTriangle, values, true),
  entry('coaching-should-fix', 'Coaching suggestion: …', AlertCircle, values, true),
  entry('coaching-could-fix', 'Coaching suggestion: …', Wrench, values, true),
  entry('coaching-technique', 'Coaching suggestion: …', GraduationCap, values, true),
  entry('coaching-uncategorised', 'Coaching suggestion: …', Lightbulb, values, true),
  entry('flagged-assumption', 'Flagged as assumption', Flag, values, true),
  entry('evidence-priority', 'Evidence priority: …', ListFilter, ['decision'], true),
] as const satisfies readonly CardMarkDefinition[]
export type CardMarkId = typeof CARD_MARKS[number]['id']
export function cardMark(id: CardMarkId): CardMarkDefinition {
  return CARD_MARKS.find(m => m.id === id)!
}
export const RENDERED_CARD_MARKS = CARD_MARKS.filter(m => m.rendered)

/** One shape per source, including the card's existing structural provenance claims. */
export function sourceCardMarkId(kind: ValueProvenanceKind): CardMarkId {
  switch (kind) {
    case 'ai': case 'accepted': return 'source-olumi'
    case 'human': return 'source-you'
    case 'assumption': return 'flagged-assumption'
    default: return `source-${kind}`
  }
}
export function coachingCardMarkId(category: string | undefined): CardMarkId {
  switch (category) {
    case 'must_fix': return 'coaching-must-fix'
    case 'should_fix': return 'coaching-should-fix'
    case 'could_fix': return 'coaching-could-fix'
    case 'technique': return 'coaching-technique'
    default: return 'coaching-uncategorised'
  }
}
