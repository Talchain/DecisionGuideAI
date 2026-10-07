import {
  Anchor, BadgeHelp, Bookmark, CircleDashed, CircleSlash, Clock, EyeOff,
  Gauge, History, HelpCircle, ListChecks, ListOrdered, Grid2x2, ScanLine,
  SignalLow, SignalMedium, SignalHigh, Signal, Minus, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
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
  readonly keyText: string
  readonly ariaWords: string
  /** Slice A renders this mark. Slice B inventory is data only. */
  readonly rendered: boolean
}
const values = ['factor', 'option', 'outcome', 'risk', 'goal'] as const
function entry<Id extends string>(id: Id, words: string, Icon: LucideIcon, nodeTypes: readonly string[], rendered = false, keyText = words, ariaWords = keyText): CardMarkDefinition & { readonly id: Id } {
  return { id, words, Icon, nodeTypes, keyText, ariaWords, rendered }
}
/** Whole UI-DESIGN §1a inventory at f01a4427. Content change rows stay content. */
export const CARD_MARKS = [
  entry('share-withheld', NOT_RANKED_MARKER, EyeOff, ['option'], true),
  entry('current-model', OPTION_RESULT_COPY.current, Gauge, ['option']),
  entry('model-result', OPTION_RESULT_COPY.unconfirmed, ScanLine, ['option']),
  entry('compact-model', OPTION_RESULT_COPY.compact, BookOpen, ['option']),
  entry('provisional', OPTION_RESULT_COPY.provisional, BadgeHelp, ['option'], true),
  entry('last-run', OPTION_RESULT_COPY.lastRun, Clock, ['option'], true),
  entry('no-new-comparison', OPTION_RESULT_COPY.lastRunNoNewComparison, History, ['option'], true),
  entry('baseline-no-changes', 'Baseline · no changes', Anchor, ['option'], true),
  entry('baseline-option', 'Baseline option', Bookmark, ['option'], true),
  entry('not-analysed', 'Not analysed', CircleSlash, ['option'], true),
  entry('needs-input', 'Needs input', CircleDashed, ['option']),
  entry('source-olumi', UNCONFIRMED_ESTIMATE_TOKEN, VALUE_PROVENANCE_ICON.ai, values, true, UNCONFIRMED_ESTIMATE_TOKEN, `Olumi estimate — ${UNCONFIRMED_ESTIMATE_LABEL.toLowerCase()}`),
  entry('source-brief', 'brief', VALUE_PROVENANCE_ICON.brief, values, true, 'From your brief'),
  entry('source-you', 'you', VALUE_PROVENANCE_ICON.human, values, true, 'Set by you'),
  entry('source-panel', 'panel', VALUE_PROVENANCE_ICON.panel, values, true, VALUE_PROVENANCE_LABEL.panel),
  entry('source-unknown', 'no source', HelpCircle, values, true, 'Source not recorded'),
  entry('tier-very-low', 'Very low', Minus, ['factor']),
  entry('tier-low', 'Low', SignalLow, ['factor']),
  entry('tier-medium', 'Medium', SignalMedium, ['factor']),
  entry('tier-high', 'High', SignalHigh, ['factor']),
  entry('tier-very-high', 'Very high', Signal, ['factor']),
  entry('driver', 'Driver N of M ranked in this run', ListOrdered, ['factor']),
  entry('driver-last-run', 'Last run · Driver N of M ranked', History, ['factor']),
  entry('driver-no-value', 'Driver N of M ranked · no value yet', ListChecks, ['factor']),
  entry('working-assumption', FACTOR_NO_ANALYSIS_YET_SHORT, BookOpen, ['factor']),
  entry('working-assumption-no-analysis', 'Working assumption · no analysis yet', CircleDashed, ['factor']),
  entry('outcome-unquantified', 'Outcome not quantified', Gauge, ['outcome']),
  entry('risk-unset', 'Likelihood and impact not set yet', Grid2x2, ['risk']),
  entry('risk-entered', ' · entered', VALUE_PROVENANCE_ICON.human, ['risk']),
  entry('target-not-captured', 'Target not captured', ScanLine, ['goal']),
  entry('assumptions-open', 'Assumptions open for review', BookOpen, ['decision']),
  entry('evidence-priority', 'Evidence priority: …', ListChecks, ['decision']),
] as const satisfies readonly CardMarkDefinition[]
export type CardMarkId = typeof CARD_MARKS[number]['id']
export function cardMark(id: CardMarkId): CardMarkDefinition {
  return CARD_MARKS.find(m => m.id === id)!
}
export const RENDERED_CARD_MARKS = CARD_MARKS.filter(m => m.rendered)
