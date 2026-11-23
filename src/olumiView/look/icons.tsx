/**
 * THE ICON REGISTRY (Paul, 17 Nov: "we should utilise icons and images as a priority… Anything that's standard text should be an icon with a
 * hover-over"). One meaning per icon and one icon per meaning; each entry names its hover words, its colour (a token in `src/styles/brand.css`,
 * never a new colour), whether it stands alone or sits beside words, and its group. Designed in output/icon-system-20261117/icon-system.json.
 * Since 18 Nov the lane's surfaces draw every icon through `OkIcon` / `OkIconButton` (the Olumi mark is the registry's `olumi-mark`, the one exception);
 * `look/__tests__/oneIconSystem.spec.tsx` scans those files and fails on a direct lucide-react or Olumi-mark import.
 *
 * Words that come from core (data-view paths) are content: an icon may sit beside them, never replace them. Where an entry names such words it
 * carries `keepWords`, and a site draws them (or passes them as `words`, which becomes the hover and label).
 *
 * HOW THE DESIGN'S CONFLICTS WERE RESOLVED (each icon one meaning):
 *  - MessageCircleQuestion was "Ask about this" and "Asked with a method": it stays the ask; the method mark is Wrench.
 *  - Unlink was "Remove link" and "No link touches this figure": it stays the action; the state is Link2Off.
 *  - Square was Stop, the limit tag and the option band square: it stays Stop only; the limit tag and the band shapes draw core's own
 *    NodeShapeIndicator (constraint, outlined square), which is not a Lucide icon.
 *  - AlertTriangle carried four meanings: split into challenged (AlertTriangle), went wrong (AlertOctagon), unsaved (CloudOff) and a stale
 *    analysis (RefreshCwOff). Colour no longer carries the difference alone.
 *  - X was cancel, close, "Keep this link" and "Clear goal": X stays the generic dismiss; keep-link is Pin and clear-goal is Eraser.
 *  - Plus was Add and the "increases" chip: Plus stays Add; the effect chips are TrendingUp and TrendingDown.
 *  - SlidersHorizontal was "Not sized yet" and "Why, and what moves it": it stays "not sized"; the why is Waypoints.
 *  - User carried four provenance meanings: User stays a person's figure; "Asked by" is MessageSquareQuote, "kept by you" UserCheck, and
 *    "Keep the original" BookmarkCheck (Undo means Undo).
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
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'
import {
  Activity, AlertOctagon, AlertTriangle, AlignLeft, ArrowDownRight, ArrowUpRight, BadgeHelp, Equal, MessagesSquare, Shuffle, Camera, ChevronDown, ChevronRight, ChevronUp, Clock, FilePlus, Folder, Hand, Keyboard, LayoutGrid, Maximize, Percent, Redo2, Scissors, Share2, BookmarkCheck, Ban, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, BadgeCheck, BarChart3, BookOpen, Brain,
  Calculator, CalendarClock, Check, CheckCheck, ChevronsDown, ChevronsUp, CircleDashed, CircleSlash, ClipboardCheck, ClipboardPen, CloudOff, Code2, Columns3, Compass,
  Copy, Crosshair, Download, Eraser, Eye, EyeOff, FileCheck, FileText, FileX, Flag, FoldVertical, Footprints, GitCommit, GitCompareArrows, GitFork,
  GraduationCap, Globe, HelpCircle, History, Hourglass, Info, Landmark, Layers, Layers2, Lightbulb, Link2, Link2Off, ListChecks, Loader2, LocateFixed, LogOut,
  Lock, MessageCircleQuestion, MessageSquare, MessageSquareQuote, MoreHorizontal, MousePointer2, Network, Paperclip, PanelRight, PanelRightClose,
  PanelRightOpen, PanelTopOpen, Pencil, Pin, Play, Plus, Printer, RefreshCw, RefreshCwOff, RotateCcw, Save, ScanSearch, ScrollText, SearchCheck, SearchX, Settings, Shapes,
  ShieldAlert, ShieldCheck, SkipForward, SlidersHorizontal, Sparkles, Split, Sprout, Square, StickyNote, Swords, Target, TextCursorInput, Trash2, TrendingDown, TrendingUp, Undo2,
  Scale, UnfoldVertical, Unlink, Unplug, Upload, User, UserCheck, UserPlus, Users, Waypoints, Wrench, X, XCircle, Zap, ZoomIn, ZoomOut, FlipVertical2,
  Repeat2, Anchor, Combine, CircleDot, FileQuestion, FlaskConical, FoldHorizontal, Ruler, ToggleRight,
  GitBranch, MoveLeft, MoveRight, Spline, Type,
  ClipboardList, CloudLightning, Dices, Goal, Route, KeyRound, LibraryBig, ListOrdered, MessageCircle,
  MessageCircleMore, PenLine, ScanEye, ShieldQuestion, Signpost, UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { CheckCircle2, LayoutList, LockKeyhole, Unlink2 } from 'lucide-react'
import { useAnchoredTip } from './Tip'
import { HIT_44 } from '../../styles/hitArea'
import { VIEW_ICON_BUTTON_CLASS, VIEW_ICON_BUTTON_PRIMARY_CLASS } from '../../v5/blocks/chipClass'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
import { typography } from '../../styles/typography'
import { isOlumiCoreLane } from '../../olumiCore/lane'
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
const DEFAULT_SIZE = 14
const LEGACY_DEFAULT_SIZE = 16
const defaultSize = () => isOlumiCoreLane() ? DEFAULT_SIZE : LEGACY_DEFAULT_SIZE

const BandShapes = ({ size = 12, className, ...rest }: IconDrawProps) => (
  <span className={`inline-flex gap-0.5 ${className ?? ''}`} {...rest}>
    {(['option', 'factor', 'outcome', 'risk', 'goal'] as const).map((k) => (
      <NodeShapeIndicator key={k} nodeKind={k} size={Number(size)} />
    ))}
  </span>
)
const LimitShape = ({ size = 12, className, ...rest }: IconDrawProps) => (
  <span className={`inline-flex ${className ?? ''}`} {...rest}>
    <NodeShapeIndicator nodeKind="constraint" size={Number(size)} />
  </span>
)
const Hairline = ({ className, ...rest }: IconDrawProps) => (
  <span className={`inline-block w-4 border-t border-panel-border ${className ?? ''}`} {...rest} />
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

const sessionMethodIcons = {
  'method-differ': e(UsersRound, 'Different perspectives', '--text-light', 'icon-only', 'olumi-ask'),
  'method-find_first': e(ListOrdered, 'What to find out first', '--text-light', 'icon-only', 'olumi-ask'),
  'method-have_true': e(KeyRound, 'What needs to be true', '--text-light', 'icon-only', 'olumi-ask'),
  'method-go_wrong': e(CloudLightning, 'What could go wrong', '--text-light', 'icon-only', 'olumi-ask'),
  'method-pre_mortem': e(ShieldQuestion, 'Imagine it failed', '--text-light', 'icon-only', 'olumi-ask'),
  'method-else_do': e(Route, 'Explore alternatives', '--text-light', 'icon-only', 'olumi-ask'),
  'method-right_question': e(MessageCircleMore, 'Revisit the question', '--text-light', 'icon-only', 'olumi-ask'),
  'method-push': e(Signpost, 'How options move the aims', '--text-light', 'icon-only', 'olumi-ask'),
  'method-similar': e(LibraryBig, 'Similar situations', '--text-light', 'icon-only', 'olumi-ask'),
  'method-rests': e(Dices, 'What rests on guesses', '--text-light', 'icon-only', 'olumi-ask'),
  'method-success': e(Goal, 'What counts as success', '--text-light', 'icon-only', 'olumi-ask'),
  'method-bias': e(ScanEye, 'Look for bias', '--text-light', 'icon-only', 'olumi-ask'),
  'method-figure_first': e(PenLine, 'Give your figure first', '--text-light', 'icon-only', 'olumi-ask'),
  'method-other': e(MessageCircle, 'Explore with Olumi', '--text-light', 'icon-only', 'olumi-ask'),
} as const

export function sessionMethodIcon(id: string): keyof typeof sessionMethodIcons {
  const key = `method-${id}`
  return Object.prototype.hasOwnProperty.call(sessionMethodIcons, key) ? key as keyof typeof sessionMethodIcons : 'method-other'
}

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
  ...sessionMethodIcons,
  'method-mark': e(Wrench, 'Asked with a method', '--text-light', 'icon-only', 'kind'),
  'idea-keep': e(Lightbulb, 'Keep as an idea', '--text-light', 'icon-only', 'olumi-ask'),
  'idea-develop': e(Sprout, 'Develop this idea', '--text-light', 'icon-only', 'olumi-ask'),
  'idea-challenge': e(Swords, 'Challenge this idea', '--text-light', 'icon-only', 'olumi-ask'),
  'explain-olumi': e(GraduationCap, 'How influence works', '--text-light', 'icon-plus-word', 'olumi-ask'),
  'talk-first': e(MessageSquare, 'Talk it through first', '--text-light', 'icon-plus-word', 'olumi-ask'),
  // Reasoning's fill-the-box press: it puts the row's words in the message box (nothing is sent); talk-first stays the composer's own send-as-talk.
  'fill-box': e(TextCursorInput, 'Put this in the message box', '--text-light', 'icon-plus-word', 'person-action'),
  'file-read': e(FileCheck, 'Olumi read this from your file', '--text-light', 'icon-plus-word', 'olumi-ask', { keepWords: 'the file-read check sentence stays words' }),

  // the person's own acts: green fill, ink (--text-header) label; quiet reversible ones stay light
  'run-analysis': e(RefreshCw, 'Re-run the analysis', '--text-light', 'icon-only', 'person-action', { activeColour: '--text-header' }),
  send: e(ArrowUp, 'Send', '--text-header', 'icon-only', 'person-action', { fill: '--success' }),
  approve: e(Check, 'Approve', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success', keepWords: "core's word where sent" }),
  'approve-ticked': e(CheckCheck, 'Approve only the changes you ticked', '--text-light', 'icon-plus-word', 'person-action'),
  'review-changes': e(ListChecks, 'Review the changes', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success' }),
  'review-inputs': e(ClipboardList, 'Review all inputs', '--text-light', 'icon-only', 'person-action'),
  'set-aside': e(Ban, 'Set aside', '--text-light', 'icon-only', 'person-action'),
  'skip-question': e(SkipForward, 'Skip', '--text-light', 'icon-only', 'person-action', { hoverColour: '--text-header' }),
  'next-step': e(Footprints, 'Next step', '--text-light', 'icon-only', 'person-action'),
  'move-tap': e(ArrowRight, 'Next', '--text-header', 'icon-plus-word', 'person-action', { fill: '--success', keepWords: "core's next.label" }),
  add: e(Plus, 'Add a figure', '--text-light', 'icon-plus-word', 'person-action', { activeColour: '--text-header' }),
  invite: e(UserPlus, 'Invite a colleague', '--text-light', 'icon-plus-word', 'person-action', { activeColour: '--text-header' }),
  'commit-action': e(ClipboardCheck, 'Record what you will do', '--text-light', 'icon-plus-word', 'person-action'),
  // The mark on an option the person has committed to (a stored commitment names it): the person's own act, so grey and never Olumi's blue.
  committed: e(BadgeCheck, 'Committed', '--text-light', 'icon-only', 'state'),
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
  'keep-original': e(BookmarkCheck, 'Keep the original', '--text-body', 'icon-plus-word', 'kind', { keepWords: "core's label (Keep the original)" }),
  goal: e(Target, 'What did you come here for?', '--text-light', 'icon-plus-word', 'kind', { keepWords: 'GOAL_QUESTION stays visible (core session.goals question); the icon sits beside it, on --goal-light' }),
  option: e(Split, 'Option', '--text-light', 'icon-only', 'kind', { keepWords: "the option card heading from core stays; only the page's own 'Option:' lead is replaced" }),
  'rests-on': e(Landmark, 'Rests on', '--text-light', 'icon-only', 'kind', { keepWords: "the rests-on card heading from core stays; only the page's own 'Rests on:' lead is replaced" }),
  'risk-if-failed': e(ShieldAlert, 'If it failed', '--text-light', 'icon-only', 'kind', { keepWords: 'the story heading (data-view `${at}.answer.stories_heading`) stays' }),
  brief: e(FileText, 'Your brief', '--text-light', 'icon-only', 'kind', { hoverColour: '--text-header' }),
  'effect-up': e(TrendingUp, 'Increases', '--text-light', 'icon-only', 'kind'),
  'effect-down': e(TrendingDown, 'Decreases', '--text-light', 'icon-only', 'kind'),
  'assumption-tag': e(CircleDashed, 'Assumption', '--text-light', 'icon-only', 'kind'),
  'conditional-tag': e(GitBranch, 'Conditional', '--text-light', 'icon-plus-word', 'kind'),
  'baseline-tag': e(Flag, 'The option you already have', '--text-body', 'icon-plus-word', 'kind'),
  'limit-tag': e(LimitShape, 'Limit', '--text-light', 'icon-plus-word', 'kind'),
  'what-if': e(ArrowRightLeft, 'What if', '--text-header', 'icon-only', 'kind'),
  'not-linked': e(Link2Off, 'No link touches this figure', '--text-light', 'icon-only', 'kind'),
  'folded-records': e(Layers, "What core folded behind this card", '--text-light', 'icon-only', 'kind', { keepWords: "core's badge words are the hover and label (`card.badge`); the count of records is drawn beside it" }),
  'decide-by': e(CalendarClock, 'Decide by', '--text-light', 'icon-plus-word', 'kind', { keepWords: "core's `decide_by` words stay drawn beside the icon" }),
  'band-kind-shapes': e(BandShapes, "The band's own sentence", '--option', 'icon-only', 'kind'),

  // states: one meaning each
  // A challenge is a warning, so it keeps the board's challenge colour (the card's frame and a challenged link draw the same token).
  challenged: e(AlertTriangle, 'Challenged', '--olumi-mark-orange', 'icon-only', 'state'),
  // Olumi's own provisional observation about a card (core's `worth_checking`): Olumi's blue, because it is Olumi's and not the person's.
  'worth-checking': e(SearchCheck, 'Olumi suggests checking this', '--info', 'icon-only', 'state'),
  // Core's own sentence (`card.unused`) is passed as this mark's words, so it is the hover and the name.
  'feeds-no-result': e(Unplug, 'Not used in the analysis yet', '--text-light', 'icon-only', 'state'),
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
  'show-in-workspace': e(LocateFixed, 'Show in the workspace', '--text-light', 'icon-only', 'navigate'),
  back: e(ArrowLeft, 'Back', '--text-light', 'icon-plus-word', 'navigate'),
  popout: e(PanelTopOpen, 'Open in floating window', '--text-light', 'icon-only', 'navigate', { alt: PanelRight }),
  zoom: e(ZoomIn, 'Zoom in for detail', '--text-body', 'icon-only', 'navigate', { alt: ZoomOut }),
  'tab-analysis': e(BarChart3, 'Analysis', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-reasoning': e(Brain, 'Reasoning', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-compare': e(GitCompareArrows, 'Compare', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'tab-model': e(Network, 'Model', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'revealed-difference': e(GitFork, 'Where you differ', '--text-light', 'icon-only', 'state', { keepWords: "core's status_text for the difference is the hover and name where the mark is drawn (CardDispute.tsx)" }),
  team: e(Users, 'Team', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  lenses: e(Layers2, "Core's lens words", '--text-light', 'icon-plus-word', 'navigate', { alt: Compass, hoverColour: '--text-header', keepWords: "core's lens_words (Model, Explore, Team)" }),

  'lens-tradeoffs': e(Scale, 'Trade-offs', '--text-light', 'icon-only', 'navigate'),
  'lens-premortem': e(CloudLightning, 'If it failed', '--text-light', 'icon-only', 'navigate'),
  'lens-what-changes': e(Activity, 'What would change', '--text-light', 'icon-only', 'navigate'),
  'more-cards': e(ChevronDown, 'More cards', '--text-light', 'icon-plus-word', 'navigate', { alt: ChevronRight }),

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
  // chrome added 18 Nov for the lane's one icon system: every glyph on the lane's surfaces draws from here
  scenario: e(Folder, 'Scenario', '--text-body', 'icon-only', 'chrome'),
  share: e(Share2, 'Share', '--text-light', 'icon-only', 'chrome'),
  'tab-journey': e(Clock, 'Journey', '--text-light', 'icon-only', 'navigate', { hoverColour: '--text-header' }),
  'fold-chevron': e(ChevronRight, 'Open or close', '--text-light', 'icon-only', 'chrome'),
  undo: e(Undo2, 'Undo', '--text-light', 'icon-only', 'chrome', { alt: Redo2 }),
  'tool-hand': e(Hand, 'Pan', '--text-light', 'icon-only', 'chrome'),
  'zoom-fit': e(Maximize, 'Fit to screen', '--text-light', 'icon-only', 'chrome'),
  'zoom-percent': e(Percent, 'Zoom level', '--text-light', 'icon-only', 'chrome'),
  'layout-grid': e(LayoutGrid, 'Layout', '--text-light', 'icon-only', 'chrome'),
  'fold-tray': e(ChevronDown, 'Fold tray', '--text-light', 'icon-only', 'chrome', { alt: ChevronUp }),
  print: e(Printer, 'Print or save as PDF', '--text-light', 'icon-plus-word', 'chrome'),
  'profile-settings': e(Settings, 'Profile settings', '--text-light', 'icon-plus-word', 'chrome'),
  privacy: e(ShieldCheck, 'Privacy notice', '--text-light', 'icon-plus-word', 'chrome'),
  'sign-out': e(LogOut, 'Sign out', '--text-light', 'icon-plus-word', 'person-action'),
  snapshot: e(Camera, 'Save a snapshot', '--text-light', 'icon-only', 'chrome'),
  'new-scenario': e(FilePlus, 'New scenario', '--text-light', 'icon-only', 'chrome'),
  shortcuts: e(Keyboard, 'Keyboard shortcuts', '--text-light', 'icon-only', 'chrome'),
  cut: e(Scissors, 'Cut', '--text-light', 'icon-only', 'chrome'),
  'chrome-kebab-sections': e(Hairline, 'Section divider', '--border-default', 'icon-only', 'chrome'),
  /* links ids */
  // A link's midpoint mark: its typed direction (panel-visual §4, L2). The hover is the fallback only: core's causal.text, effect.text and effect.title are passed as `words`.
  'link-raises': e(ArrowUpRight, 'Increases', '--text-light', 'icon-only', 'kind'),
  'link-lowers': e(ArrowDownRight, 'Decreases', '--text-light', 'icon-only', 'kind'),
  'link-depends': e(Shuffle, 'Direction not settled', '--text-light', 'icon-only', 'kind'),
  'link-disputed': e(MessagesSquare, 'Direction not settled', '--text-light', 'icon-only', 'kind'),
  'link-unknown': e(BadgeHelp, 'Direction not settled', '--text-light', 'icon-only', 'kind'),
  'link-none': e(Equal, 'No effect', '--text-light', 'icon-only', 'kind'),
  /* cards ids */
  // C5 (20 Nov): a condition card is neutral; this is its own mark (never a risk's, never inferred as an alert).
  'condition-tag': e(ToggleRight, 'Condition', '--text-light', 'icon-only', 'kind'),
  // CARDS (C3, 20 Nov): one grey mark per code of Olumi's `worth_checking` (core's nine-value enum), so each observation is its own mark; the hover is core's title and
  // sentence, passed as `words`, and the registry's words are only the generic ones. No family name core does not give (bias, evidence, range...) labels a mark.
  'check-estimate-under-aims': e(Anchor, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-result-rests-on-range': e(Ruler, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-one-figure': e(CircleDot, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-only-supporting': e(Scale, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-shared-evidence': e(Combine, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-narrow-range': e(FoldHorizontal, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-no-evidence': e(FileQuestion, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-untested-assumption': e(FlaskConical, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  'check-range-turns': e(Repeat2, 'Olumi suggests checking this', '--text-light', 'icon-only', 'state'),
  /* team ids */
  // The Team tab's marks (one meaning each). Words drawn beside them are core's (a decorative mark); the hover is the registry's fallback only.
  'differ-link': e(Unlink2, 'Where you differ', '--text-light', 'icon-plus-word', 'kind', { keepWords: "core's chip words (`chip`) and the link's label are drawn beside the mark" }),
  'private-view': e(LockKeyhole, 'Private view', '--text-light', 'icon-plus-word', 'state', { keepWords: "core's `team_words.views.private`, `give` and `shareTitle` are drawn beside the mark" }),
  'trigger-taken': e(CheckCircle2, 'Chosen', '--text-light', 'icon-plus-word', 'state', { keepWords: "core's suggested trigger sentence is drawn beside the mark" }),
  'strategy-overview': e(LayoutList, 'Strategy overview', '--text-light', 'icon-plus-word', 'chrome', { keepWords: "core's `strategy.headings.overview` is drawn beside the mark" }),
  /* model ids */
  // The Model tab's marks: a relationship's own mark (group heading and row), the two ends of a link and the rename action. Drawn beside words (decorative); the hover is a fallback.
  'model-relationship': e(Spline, 'Relationship', '--text-light', 'icon-plus-word', 'kind'),
  'model-link-from': e(MoveLeft, 'From', '--text-light', 'icon-plus-word', 'kind'),
  'model-link-to': e(MoveRight, 'To', '--text-light', 'icon-plus-word', 'kind'),
  'model-rename': e(Type, 'Rename', '--text-light', 'icon-plus-word', 'person-action'),
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
  /** Take the colour of the control around it (a tab's active text, a danger row, a disabled button) instead of the entry's own token. */
  inherit?: boolean
  /** A test id on the drawn icon's wrapper. */
  testid?: string
  /** Beside visible words: hidden from assistive tech. Default: true for icon-plus-word entries. */
  decorative?: boolean
  /** Alone (not decorative): a keyboard stop that shows its words on focus. Default true; it is dropped on its own when the icon sits inside an interactive control (never nested focus targets). */
  focusable?: boolean
  className?: string
}

/** A registry colour token as a text-colour CLASS (never an inline style), so a `disabled:` or hover class can win over it. Literal strings, so the build sees each one. */
const TEXT_COLOUR: Readonly<Record<string, string>> = {
  '--text-light': 'text-text-light', '--text-header': 'text-text-header', '--text-body': 'text-text-body',
  '--danger': 'text-danger', '--info': 'text-info', '--warning': 'text-warning', '--success': 'text-success', '--option': 'text-option',
  '--border-default': 'text-[color:var(--border-default)]', '--olumi-mark-orange': 'text-[color:var(--olumi-mark-orange)]',
}
/** The class for a registry token; a token with no class is a registry error the icons spec catches (every colour the registry names has one). */
export const colourClass = (token: string): string => TEXT_COLOUR[token] ?? ''
export const COLOUR_TOKENS: readonly string[] = Object.keys(TEXT_COLOUR)

function pick(id: IconId, variant?: 'alt'): IconComponent {
  const entry: IconEntry = ICONS[id]
  return variant === 'alt' && entry.alt ? entry.alt : entry.Icon
}

function Glyph({ id, size, variant, className }: { id: IconId; size: number; variant?: 'alt'; className?: string }): ReactNode {
  const Icon = pick(id, variant)
  // The Olumi mark draws with its own ring stroke (OlumiAiIcon's 2, scaled by the mark); the registry's 1.75 is for the line icons.
  if (id === 'olumi-mark') return <Icon size={size} aria-hidden="true" className={className} />
  return <Icon size={size} strokeWidth={ICON_STROKE} aria-hidden="true" className={className} />
}

/** The icon in its token colour. Beside words it is decorative; alone it is an image labelled and titled with the hover (or core's words). */
export function OkIcon({ id, size = defaultSize(), words, variant, active, inherit, testid, decorative, focusable = true, className }: OkIconProps) {
  const entry: IconEntry = ICONS[id]
  const label = words ?? entry.hover
  const hidden = decorative ?? entry.mode === 'icon-plus-word'
  const token = active && entry.activeColour ? entry.activeColour : entry.colour
  const cls = `inline-flex shrink-0 items-center justify-center${inherit ? '' : ` ${colourClass(token)}`}${className ? ` ${className}` : ''}`
  if (hidden) {
    return (
      <span aria-hidden="true" className={cls} data-testid={testid}>
        <Glyph id={id} size={size} variant={variant} />
      </span>
    )
  }
  return <LabelledIcon label={label} cls={cls} testid={testid} focusable={focusable}><Glyph id={id} size={size} variant={variant} /></LabelledIcon>
}

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [tabindex], [role="button"], [role="menuitem"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"]'

/** An icon alone: an image named by aria-label whose words show through the one Tip (150 ms, beside it), never a native title. It takes keyboard focus so the words are reachable. Inside an interactive ancestor it takes none (one focus stop, the ancestor): the Tip then opens on that ancestor's keyboard focus (standing beside it and describing it while open) and on the pointer resting on the icon itself, so a card's own tip and an icon's tip inside it never open together. */
export function LabelledIcon({ label, cls, testid, focusable = true, attrs, children }: { label: string; cls: string; testid?: string; focusable?: boolean; /** Pass-through attributes (data marks) for the span. */ attrs?: Readonly<Record<string, string | undefined>>; children: ReactNode }) {
  const { handlers, tip, describedBy } = useAnchoredTip(label)
  const el = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => { setHost(el.current?.parentElement?.closest<HTMLElement>(INTERACTIVE) ?? null) }, [])
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    if (host === null) return
    const at = { currentTarget: host } as unknown as SyntheticEvent<HTMLElement>
    const onFocus = () => latest.current.onFocus(at)
    const onBlur = () => latest.current.onBlur()
    const onKey = (e: Event) => latest.current.onKeyDown({ key: (e as KeyboardEvent).key } as never)
    host.addEventListener('focus', onFocus); host.addEventListener('blur', onBlur); host.addEventListener('keydown', onKey)
    return () => {
      host.removeEventListener('focus', onFocus); host.removeEventListener('blur', onBlur); host.removeEventListener('keydown', onKey)
    }
  }, [host])
  // While open the ancestor (the one focus stop) carries the description; the previous value is put back on close.
  useEffect(() => {
    if (host === null || describedBy === undefined) return
    const before = host.getAttribute('aria-describedby')
    host.setAttribute('aria-describedby', before === null || before === '' ? describedBy : `${before} ${describedBy}`)
    return () => { if (before === null) host.removeAttribute('aria-describedby'); else host.setAttribute('aria-describedby', before) }
  }, [host, describedBy])
  const alone = host === null
  return (
    <>
      <span ref={el} {...attrs} role="img" aria-label={label} tabIndex={alone && focusable ? 0 : undefined} aria-describedby={alone ? describedBy : undefined} className={cls} data-testid={testid} {...(alone ? handlers : { onPointerEnter: handlers.onPointerEnter, onPointerLeave: handlers.onPointerLeave })}>{children}</span>
      {tip}
    </>
  )
}

interface OkIconButtonProps {
  id: IconId
  onClick: () => void
  words?: string
  variant?: 'alt'
  active?: boolean
  /** A toggle that is on (a challenge waiting for its card): said to assistive technology as pressed. Omitted for a plain press. */
  pressed?: boolean
  /** A disclosure's trigger (panel P4, additive for the reply-facts row): said as expanded or collapsed, and `controls` names the body it opens (its id). Not for a toggle: that is `pressed`. */
  expanded?: boolean
  controls?: string
  disabled?: boolean
  testid?: string
  size?: number
  className?: string
  /** The lane's compact icon button (18 Nov): a 28px square, ghost grey or solid green, in place of the 44px hit area. Omitted: the 44px one. */
  tone?: 'ghost' | 'primary'
  /** A hover (the Tip) that differs from the accessible name: the name is `words`, the hover this. Omitted: both are the same words. */
  hover?: string
  /** A small tabular numeral beside the icon inside the same control (Approve ticked · N): drawn, and the label still carries it in words. */
  count?: number
}

/** An icon-only press (held = aria-disabled, still focusable, so its reason shows; the press is a no-op): a 44 px hit area, the hover words are the aria-label and, through the one Tip, the hover (no native title); focus is left to the global outline. */
export function OkIconButton({ id, onClick, words, hover, variant, active, pressed, expanded, controls, disabled, testid, size = defaultSize(), className, tone, count }: OkIconButtonProps) {
  const entry: IconEntry = ICONS[id]
  const label = words ?? entry.hover
  const shown = hover ?? label
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(shown)
  const token = active && entry.activeColour ? entry.activeColour : entry.colour
  return (
    <>
    <button
      type="button"
      onClick={() => { dismiss(); if (!disabled) onClick() }}
      {...handlers}
      aria-describedby={shown !== label ? describedBy : undefined}
      aria-disabled={disabled === true ? true : undefined}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={expanded === undefined ? undefined : controls}
      data-testid={testid}
      className={`ok-icon-btn${tone === 'primary' ? ' ok-icon-btn-primary' : ''} ${tone === undefined ? `${HIT_44} inline-flex shrink-0 items-center justify-center disabled:text-text-light` : tone === 'primary' ? VIEW_ICON_BUTTON_PRIMARY_CLASS : VIEW_ICON_BUTTON_CLASS}${tone === 'primary' ? '' : ` ${colourClass(token)}`}${count === undefined ? '' : ' gap-1 px-1.5'}${className ? ` ${className}` : ''}`}
    >
      <Glyph id={id} size={size} variant={variant} />
      {count === undefined ? null : <span className={`${typography.caption} tabular-nums`} data-testid={testid === undefined ? undefined : `${testid}-count`} aria-hidden="true">{count}</span>}
    </button>
    {tip}
    </>
  )
}
