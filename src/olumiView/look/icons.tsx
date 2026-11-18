/**
 * THE ICON REGISTRY (Paul, 17 Nov: "we should utilise icons and images as a priority… Anything that's standard text should be an icon with a
 * hover-over"). One meaning per icon and one icon per meaning; each entry names its hover words, its colour (a token in `src/styles/brand.css`,
 * never a new colour), whether it stands alone or sits beside words, and its group. Designed in output/icon-system-20261117/icon-system.json.
 * This file is the registry only: no call site is migrated here.
 *
 * Words that come from core (data-view paths) are content: an icon may sit beside them, never replace them. Where an entry names such words it
 * carries `keepWords`, and a site draws them (or passes them as `words`, which becomes the hover and label).
 *
 * HOW THE DESIGN'S CONFLICTS WERE RESOLVED (each icon one meaning):
 *  - MessageCircleQuestion was "Ask about this" and "Asked with a method": it stays the ask; the method mark is Wrench.
 *  - Unlink was "Remove link" and "No link touches this figure": it stays the action; the state is Link2Off.
 *  - Square was Stop, the limit tag and the option band square: it stays Stop only; the limit tag and the band shapes draw core's own
 *    NodeShapeIndicator (constraint, dashed outline), which is not a Lucide icon.
 *  - AlertTriangle carried four meanings: split into challenged (AlertTriangle), went wrong (AlertOctagon), unsaved (CloudOff) and a stale
 *    analysis (RefreshCwOff). Colour no longer carries the difference alone.
 *  - X was cancel, close, "Keep this link" and "Clear goal": X stays the generic dismiss; keep-link is Pin and clear-goal is Eraser.
 *  - Plus was Add and the "increases" chip: Plus stays Add; the effect chips are TrendingUp and TrendingDown.
 *  - SlidersHorizontal was "Not sized yet" and "Why, and what moves it": it stays "not sized"; the why is Waypoints.
 *  - User carried four provenance meanings: User stays a person's figure; "Asked by" is MessageSquareQuote, "kept by you" UserCheck, and
 *    "Keep the original" Undo2.
 *  - Olumi had two icons: OlumiAiIcon is Olumi's identity (the mark); Sparkles is only the "Olumi contributes" lead (two meanings, two icons,
 *    as marks.tsx says Olumi's mark is never a sparkle).
 *  - Info and HelpCircle: Info is "more detail", HelpCircle only "cannot confirm". Legacy Edit2, MoreVertical, ArrowLeftRight (outside
 *    what-if) and Eye (outside Views) must be migrated to Pencil, MoreHorizontal, the method icons and Lock, or the old name survives beside
 *    the new.
 *  - Eye + Columns3 in one row: Views is Eye, "Compare views" its own entry. Download and Upload: Export and Import, one each.
 *  - Colour wording: "ink" resolves to --text-header and "solid neutral" to --border-default, so no new colour is introduced.
 *  - ICONS CARRY NO HUE (Paul, 17 Nov, on the coloured panel mock: "so far, we've only had non-coloured icons. If we keep them non-coloured,
 *    that's one less thing that's busy"). Every unfilled icon draws a grey (--text-light at rest, --text-header when active). Colour stays
 *    only where it is the meaning: Olumi's own mark (--info), a failure or warning (delete, went wrong, save failed, unsaved, stale), a
 *    kind's own shape (limit, band shapes), and the person's filled acts (--success fill, ink glyph). Kind and chart colour lives in the
 *    shapes, bars and fills, never in a Lucide glyph.
 *  - --success is also the outcome band shape: that shape is never a control, it is told apart by shape, and it stays (NodeShapeIndicator owns it).
 *  - core's words kept (`keepWords`): the info status line while waiting, core's olumi.text on the mark, GOAL_QUESTION (so Goal is icon plus
 *    word), the EarlyAnswer caveat, the story headings, and lens and next-step labels (icon plus word).
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import {
  AlertOctagon, AlertTriangle, AlignLeft, ArchiveX, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, BarChart3, BookOpen, Brain,
  Calculator, Check, CheckCheck, ChevronsDown, ChevronsUp, CircleDashed, CircleSlash, ClipboardCheck, ClipboardPen, CloudOff, Code2, Columns3, Compass,
  Copy, Crosshair, Download, Eraser, Eye, EyeOff, FileCheck, FileText, FileX, Flag, FoldVertical, Footprints, GitCommit, GitCompareArrows,
  GraduationCap, Globe, HelpCircle, History, Hourglass, Info, Landmark, Layers2, Lightbulb, Link2, Link2Off, ListChecks, Loader2, LocateFixed,
  Lock, MessageCircleQuestion, MessageSquare, MessageSquareQuote, MoreHorizontal, MousePointer2, Network, Paperclip, PanelRight, PanelRightClose,
  PanelRightOpen, PanelTopOpen, Pencil, Pin, Play, Plus, RefreshCw, RefreshCwOff, RotateCcw, Save, ScanSearch, ScrollText, SearchCheck, SearchX, Shapes,
  ShieldAlert, SkipForward, SlidersHorizontal, Sparkles, Split, Sprout, Square, StickyNote, Swords, Target, Trash2, TrendingDown, TrendingUp, Undo2,
  UnfoldVertical, Unlink, Unplug, Upload, User, UserCheck, UserPlus, Users, Waypoints, Wrench, X, XCircle, Zap, ZoomIn, ZoomOut, FlipVertical2,
  type LucideIcon,
} from 'lucide-react'
import { HIT_44 } from '../../styles/hitArea'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'


export type IconGroup = 'olumi-ask' | 'person-action' | 'state' | 'kind' | 'navigate' | 'chrome'
export type IconMode = 'icon-only' | 'icon-plus-word'

export interface IconDrawProps {
  size?: number | string
  strokeWidth?: number | string
  className?: string
  style?: CSSProperties
  'aria-hidden'?: boolean | 'true' | 'false'
}
/** A Lucide icon, the brand mark, or one of the three small drawn shapes below. */
export type IconComponent = LucideIcon | ComponentType<IconDrawProps>

export interface IconEntry {
  Icon: IconComponent
  /** The state variant of the same meaning (a fold/unfold pair, held/shown), never a second meaning. */
  alt?: IconComponent
  /** The words on hover; `{card}` and the like are filled by the site, or core's own label is passed as `words`. */
  hover: string
  /** A token in src/styles/brand.css, including the leading `--`. */
  colour: string
  /** The token while the thing is happening (Olumi running the analysis). */
  activeColour?: string
  /** The token under the pointer, where the rest colour is lighter. */
  hoverColour?: string
  /** The person's filled actions: the fill token. The icon or label sits on it in `colour` (--text-header). */
  fill?: string
  mode: IconMode
  group: IconGroup
  /** Core's words that must stay visible where this icon sits: the icon goes beside them, never in their place. */
  keepWords?: string
}

const ICON_STROKE = 1.75
const DEFAULT_SIZE = 16

const BandShapes = ({ size = 12, className, style, ...rest }: IconDrawProps) => (
  <span className={className} style={{ display: 'inline-flex', gap: 2, ...style }} {...rest}>
    {(['option', 'factor', 'outcome', 'risk', 'goal'] as const).map((k) => (
      <NodeShapeIndicator key={k} nodeKind={k} size={Number(size)} />
    ))}
  </span>
)
const LimitShape = ({ size = 12, className, style, ...rest }: IconDrawProps) => (
  <span className={className} style={{ display: 'inline-flex', ...style }} {...rest}>
    <NodeShapeIndicator nodeKind="constraint" size={Number(size)} dashedOutline />
  </span>
)
const Hairline = ({ className, style, ...rest }: IconDrawProps) => (
  <span className={className} style={{ display: 'inline-block', width: 16, borderTop: '1px solid var(--border-default)', ...style }} {...rest} />
)

const OLUMI_STATIC: IconComponent = OlumiAiIcon as IconComponent

const e = (
  Icon: IconComponent,
  hover: string,
  colour: string,
  mode: IconMode,
  group: IconGroup,
  extra: Partial<Omit<IconEntry, 'Icon' | 'hover' | 'colour' | 'mode' | 'group'>> = {},
): IconEntry => ({ Icon, hover, colour, mode, group, ...extra })

export const ICONS = {
  // Olumi: blue is Olumi's, and only Olumi's
  'olumi-mark': e(OLUMI_STATIC, 'Olumi', '--info', 'icon-only', 'olumi-ask', { keepWords: "core's olumi.text is the hover and label where the reply's mark is drawn (data-view `${at}.answer.mark`)" }),
  'olumi-contributes': e(Sparkles, 'Olumi’s initial reply', '--text-light', 'icon-only', 'olumi-ask', { keepWords: 'the EarlyAnswer caveat sentence (unverified general knowledge) stays as words; the icon leads it' }),
  'olumi-thinking': e(Loader2, 'Olumi is thinking…', '--text-light', 'icon-only', 'state'),
  'ask-about-this': e(MessageCircleQuestion, 'Ask about {card}', '--text-light', 'icon-only', 'olumi-ask'),
  'method-challenge': e(Zap, 'Challenge it', '--text-light', 'icon-only', 'olumi-ask'),
  'method-opposite': e(FlipVertical2, 'The opposite', '--text-light', 'icon-only', 'olumi-ask'),
  'method-disprove': e(SearchX, 'What would disprove it', '--text-light', 'icon-only', 'olumi-ask'),
  'method-outside': e(Globe, 'Outside view', '--text-light', 'icon-only', 'olumi-ask'),
  'method-mark': e(Wrench, 'Asked with a method', '--text-light', 'icon-only', 'kind'),
  'idea-keep': e(Lightbulb, 'Keep as an idea', '--text-light', 'icon-only', 'olumi-ask'),
  'idea-develop': e(Sprout, 'Develop this idea', '--text-light', 'icon-only', 'olumi-ask'),
  'idea-challenge': e(Swords, 'Challenge this idea', '--text-light', 'icon-only', 'olumi-ask'),
  'explain-olumi': e(GraduationCap, 'How influence works', '--text-light', 'icon-plus-word', 'olumi-ask'),
  'talk-first': e(MessageSquare, 'Talk it through first', '--text-light', 'icon-plus-word', 'olumi-ask'),
  'file-read': e(FileCheck, 'Olumi read this from your file', '--text-light', 'icon-plus-word', 'olumi-ask', { keepWords: 'the file-read check sentence stays words' }),

  // the person's own acts: green fill, ink (--text-header) label; quiet reversible ones stay light
  'run-analysis': e(RefreshCw, 'Re-run the analysis', '--text-light', 'icon-only', 'person-action', { activeColour: '--text-header' }),
  send: e(ArrowUp, 'Send', '--text-header', 'icon-only', 'person-action', { fill: '--success' }),
  approve: e(Check, 'Approve', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success', keepWords: "core's word where sent" }),
  'approve-ticked': e(CheckCheck, 'Approve only the changes you ticked', '--text-light', 'icon-plus-word', 'person-action'),
  'review-changes': e(ListChecks, 'Review the changes', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success' }),
  'set-aside': e(ArchiveX, 'Set aside', '--text-light', 'icon-only', 'person-action'),
  'skip-question': e(SkipForward, 'Skip', '--text-light', 'icon-only', 'person-action', { hoverColour: '--text-header' }),
  'next-step': e(Footprints, 'Next step', '--text-light', 'icon-only', 'person-action'),
  'move-tap': e(ArrowRight, 'Next', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success', keepWords: "core's next.label" }),
  add: e(Plus, 'Add a figure', '--text-light', 'icon-plus-word', 'person-action', { activeColour: '--text-header' }),
  invite: e(UserPlus, 'Invite a colleague', '--text-light', 'icon-plus-word', 'person-action', { activeColour: '--text-header' }),
  'commit-action': e(ClipboardCheck, 'Record what you will do', '--text-light', 'icon-plus-word', 'person-action'),
  'use-as-action': e(ClipboardPen, 'Use as my action', '--text-light', 'icon-only', 'person-action'),
  retry: e(RotateCcw, 'Try again', '--text-light', 'icon-plus-word', 'person-action'),
  edit: e(Pencil, 'Change', '--text-light', 'icon-only', 'person-action', { hoverColour: '--text-header' }),
  'cancel-close': e(X, 'Cancel', '--text-light', 'icon-only', 'person-action'),
  'keep-link': e(Pin, 'Keep this link', '--text-light', 'icon-only', 'person-action'),
  'clear-goal': e(Eraser, 'Clear goal', '--text-light', 'icon-only', 'person-action'),
  'try-without-saving': e(Play, 'Try without saving', '--text-body', 'icon-only', 'person-action'),
  'remove-link': e(Unlink, 'Remove link', '--text-light', 'icon-only', 'person-action', { hoverColour: '--danger' }),
  delete: e(Trash2, 'Delete', '--danger', 'icon-only', 'person-action'),
  'remove-added-text': e(FileX, 'Remove what was added', '--text-light', 'icon-only', 'person-action', { hoverColour: '--danger' }),
  attach: e(Paperclip, 'Upload a document (.xlsx, .csv, .pptx, .docx, .pdf)', '--text-body', 'icon-only', 'person-action', { hoverColour: '--text-header' }),
  save: e(Save, 'Save', '--text-light', 'icon-only', 'person-action'),

  // kinds
  'person-mark': e(User, 'A person’s figure', '--text-header', 'icon-only', 'kind'),
  'asked-by': e(MessageSquareQuote, 'Asked by', '--text-light', 'icon-only', 'kind'),
  'kept-by-you': e(UserCheck, 'Kept by you', '--text-light', 'icon-only', 'kind'),
  'keep-original': e(Undo2, 'Keep the original', '--text-body', 'icon-plus-word', 'kind', { keepWords: "core's label (Keep the original)" }),
  goal: e(Target, 'What did you come here for?', '--text-light', 'icon-plus-word', 'kind', { keepWords: 'GOAL_QUESTION stays visible (core session.goals question); the icon sits beside it, on --goal-light' }),
  option: e(Split, 'Option', '--text-light', 'icon-only', 'kind', { keepWords: "the option card heading from core stays; only the page's own 'Option:' lead is replaced" }),
  'rests-on': e(Landmark, 'Rests on', '--text-light', 'icon-only', 'kind', { keepWords: "the rests-on card heading from core stays; only the page's own 'Rests on:' lead is replaced" }),
  'risk-if-failed': e(ShieldAlert, 'If it failed', '--text-light', 'icon-only', 'kind', { keepWords: 'the story heading (data-view `${at}.answer.stories_heading`) stays' }),
  brief: e(FileText, 'Your brief', '--text-light', 'icon-only', 'kind', { hoverColour: '--text-header' }),
  'effect-up': e(TrendingUp, 'Increases', '--text-light', 'icon-only', 'kind'),
  'effect-down': e(TrendingDown, 'Decreases', '--text-light', 'icon-only', 'kind'),
  'assumption-tag': e(CircleDashed, 'Assumption', '--text-light', 'icon-only', 'kind'),
  'baseline-tag': e(Flag, 'The option you already have', '--text-body', 'icon-plus-word', 'kind'),
  'limit-tag': e(LimitShape, 'Limit', '--text-light', 'icon-plus-word', 'kind'),
  'what-if': e(ArrowRightLeft, 'What if', '--text-header', 'icon-only', 'kind'),
  'not-linked': e(Link2Off, 'No link touches this figure', '--text-light', 'icon-only', 'kind'),
  'band-kind-shapes': e(BandShapes, "The band's own sentence", '--option', 'icon-only', 'kind'),

  // states: one meaning each
  // A challenge is a warning, so it keeps the board's challenge colour (the card's frame and a challenged link draw the same token).
  challenged: e(AlertTriangle, 'Challenged', '--olumi-mark-orange', 'icon-only', 'state'),
  // Olumi's own provisional observation about a card (core's `worth_checking`): Olumi's blue, because it is Olumi's and not the person's.
  'worth-checking': e(SearchCheck, 'Olumi suggests checking this', '--info', 'icon-only', 'state', { keepWords: "core's finding title and text are the hover" }),
  'feeds-no-result': e(Unplug, 'Not used in the analysis yet', '--text-light', 'icon-only', 'state', { keepWords: "core's own sentence (`card.unused`) is the hover" }),
  'went-wrong': e(AlertOctagon, 'Something went wrong', '--danger', 'icon-only', 'state', { keepWords: 'a failure sentence stays words (drawn in --warning-ink)' }),
  unsaved: e(CloudOff, 'Unsaved', '--warning', 'icon-only', 'state'),
  'stale-analysis': e(RefreshCwOff, 'This analysis is out of date', '--warning', 'icon-only', 'state'),
  stop: e(Square, 'Stop', '--text-light', 'icon-only', 'state', { keepWords: "core's word on the drafting board" }),
  'state-waits': e(Hourglass, 'Waiting on you', '--text-light', 'icon-plus-word', 'state'),
  'state-no-chance': e(CircleSlash, 'No chance yet', '--text-light', 'icon-plus-word', 'state'),
  'state-not-sized': e(SlidersHorizontal, 'Not sized yet', '--text-light', 'icon-only', 'state'),
  'why-moves': e(Waypoints, 'Why, and what moves it', '--text-light', 'icon-only', 'state'),
  'needs-analysis': e(Calculator, 'Needs an analysis to be worked out', '--text-light', 'icon-only', 'state'),
  'held-past-version': e(History, 'Go back to the latest version to change the model', '--text-light', 'icon-plus-word', 'state'),
  'cannot-confirm': e(HelpCircle, 'Cannot confirm whether this analysis is current.', '--text-light', 'icon-only', 'state'),
  'view-only': e(Lock, 'View only, shared with you', '--text-light', 'icon-only', 'state'),
  'save-failed': e(XCircle, 'Save failed', '--danger', 'icon-plus-word', 'state'),

  // navigation
  'go-latest': e(ArrowDownToLine, 'Back to the latest', '--text-light', 'icon-only', 'navigate'),
  'on-canvas': e(Crosshair, 'About {cards} on the canvas', '--text-light', 'icon-only', 'navigate'),
  'show-in-workspace': e(LocateFixed, 'Show in the workspace', '--text-light', 'icon-only', 'navigate', { alt: ArrowLeft }),
  popout: e(PanelTopOpen, 'Open in floating window', '--text-light', 'icon-only', 'navigate', { alt: PanelRight }),
  zoom: e(ZoomIn, 'Zoom in for detail', '--text-body', 'icon-only', 'navigate', { alt: ZoomOut }),
  'tab-analysis': e(BarChart3, 'Analysis', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-reasoning': e(Brain, 'Reasoning', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-compare': e(GitCompareArrows, 'Compare', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-model': e(Network, 'Model', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  team: e(Users, 'Team', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  lenses: e(Layers2, "Core's lens words", '--text-light', 'icon-plus-word', 'navigate', { alt: Compass, hoverColour: '--text-header', keepWords: "core's lens_words (Model, Explore, Team)" }),

  // chrome
  'info-more': e(Info, 'More detail', '--text-light', 'icon-only', 'chrome', { keepWords: "core's status line (data-view `${at}.status`) stays visible while waiting" }),
  more: e(MoreHorizontal, 'More options', '--text-light', 'icon-only', 'chrome'),
  'fold-more': e(ChevronsDown, 'Show the whole reply', '--text-light', 'icon-only', 'chrome', { alt: ChevronsUp }),
  'full-answer': e(ScrollText, 'Full answer', '--text-light', 'icon-only', 'chrome'),
  'level-simple-detailed': e(Shapes, 'Simple', '--text-light', 'icon-only', 'chrome', { alt: AlignLeft, hoverColour: '--text-header' }),
  views: e(Eye, 'Show each person’s view', '--text-light', 'icon-only', 'chrome', { alt: EyeOff, activeColour: '--text-header' }),
  'compare-views': e(Columns3, 'Compare views', '--text-light', 'icon-only', 'chrome', { activeColour: '--text-header' }),
  'key-legend': e(BookOpen, 'Key', '--text-light', 'icon-only', 'chrome'),
  'fold-group': e(UnfoldVertical, 'Show these inputs in place', '--text-light', 'icon-only', 'chrome', { alt: FoldVertical }),
  'notes-count': e(StickyNote, 'Notes', '--text-light', 'icon-only', 'chrome'),
  inspect: e(ScanSearch, 'Inspect this analysis', '--text-light', 'icon-only', 'chrome'),
  'collapse-dock': e(PanelRightClose, 'Collapse the outputs dock', '--text-light', 'icon-only', 'chrome', { alt: PanelRightOpen }),
  'expert-mode': e(Code2, 'Expert mode', '--text-light', 'icon-only', 'chrome', { activeColour: '--text-header' }),
  'copy-link': e(Link2, 'Copy link to summary', '--text-light', 'icon-only', 'chrome'),
  'version-tag': e(GitCommit, "Core's version label", '--text-light', 'icon-plus-word', 'chrome', { keepWords: "core's version.label" }),
  export: e(Download, 'Export', '--text-light', 'icon-plus-word', 'chrome'),
  import: e(Upload, 'Import', '--text-light', 'icon-plus-word', 'chrome'),
  duplicate: e(Copy, 'Duplicate', '--text-light', 'icon-only', 'chrome'),
  'selected-row': e(MousePointer2, 'Selected', '--text-light', 'icon-only', 'chrome'),
  'chrome-kebab-sections': e(Hairline, 'Section divider', '--border-default', 'icon-only', 'chrome'),
} as const satisfies Record<string, IconEntry>

export type IconId = keyof typeof ICONS

/** Every id that draws a Lucide icon more than once (as primary or state variant), or reuses one across ids. Empty means one icon per meaning. */
export function duplicateIconIds(registry: Readonly<Record<string, Pick<IconEntry, 'Icon' | 'alt'>>>): string[] {
  const seen = new Map<unknown, string>()
  const dupes = new Set<string>()
  for (const [id, entry] of Object.entries(registry)) {
    for (const Icon of [entry.Icon, entry.alt]) {
      if (!Icon) continue
      const owner = seen.get(Icon)
      if (owner !== undefined) {
        dupes.add(owner)
        dupes.add(id)
      } else seen.set(Icon, id)
    }
  }
  return [...dupes].sort()
}

interface OkIconProps {
  id: IconId
  size?: number
  /** Core's own words for this site: they become the hover and the label (and are never replaced by the registry's). */
  words?: string
  /** Draw the state variant (unfold/fold, shown/hidden). */
  variant?: 'alt'
  /** Draw in the entry's `activeColour` (running, held, on). */
  active?: boolean
  /** Beside visible words: hidden from assistive tech. Default: true for icon-plus-word entries. */
  decorative?: boolean
  className?: string
}

const colourVar = (token: string) => `var(${token})`

function pick(id: IconId, variant?: 'alt'): IconComponent {
  const entry: IconEntry = ICONS[id]
  return variant === 'alt' && entry.alt ? entry.alt : entry.Icon
}

function Glyph({ id, size, variant, className }: { id: IconId; size: number; variant?: 'alt'; className?: string }): ReactNode {
  const Icon = pick(id, variant)
  return <Icon size={size} strokeWidth={ICON_STROKE} aria-hidden="true" className={className} />
}

/** The icon in its token colour. Beside words it is decorative; alone it is an image labelled and titled with the hover (or core's words). */
export function OkIcon({ id, size = DEFAULT_SIZE, words, variant, active, decorative, className }: OkIconProps) {
  const entry: IconEntry = ICONS[id]
  const label = words ?? entry.hover
  const hidden = decorative ?? entry.mode === 'icon-plus-word'
  const token = active && entry.activeColour ? entry.activeColour : entry.colour
  const style: CSSProperties = { color: colourVar(token) }
  const cls = `inline-flex shrink-0 items-center justify-center${className ? ` ${className}` : ''}`
  if (hidden) {
    return (
      <span aria-hidden="true" className={cls} style={style}>
        <Glyph id={id} size={size} variant={variant} />
      </span>
    )
  }
  return (
    <span role="img" aria-label={label} title={label} className={cls} style={style}>
      <Glyph id={id} size={size} variant={variant} />
    </span>
  )
}

interface OkIconButtonProps {
  id: IconId
  onClick: () => void
  words?: string
  variant?: 'alt'
  active?: boolean
  disabled?: boolean
  testid?: string
  size?: number
  className?: string
}

/** An icon-only press: a 44 px hit area, the hover words as both aria-label and title; focus is left to the global outline. */
export function OkIconButton({ id, onClick, words, variant, active, disabled, testid, size = DEFAULT_SIZE, className }: OkIconButtonProps) {
  const entry: IconEntry = ICONS[id]
  const label = words ?? entry.hover
  const token = active && entry.activeColour ? entry.activeColour : entry.colour
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testid}
      className={`${HIT_44} inline-flex shrink-0 items-center justify-center${className ? ` ${className}` : ''}`}
      style={{ color: disabled ? colourVar('--text-light') : colourVar(token) }}
    >
      <Glyph id={id} size={size} variant={variant} />
    </button>
  )
}
