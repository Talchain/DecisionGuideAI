/**
 * AnalysisHeroV17 — decision-strengthening hero panel.
 *
 * Renders as the top section of the post-analysis Analysis tab when the
 * `analysisHeroV17` feature flag is on (replaces `DecisionConfidencePanel`
 * at that render slot). Source of truth:
 *   - docs/investigations/analysis-hero-v17.md
 *   - docs/brief-analysis-hero-v17-implementation.md
 *   - docs/Design/analysis-hero-v17-reference.html (visual reference only)
 *
 * Architecture:
 *   - Pure VM via `buildAnalysisHeroViewModel`.
 *   - State / row ranking / category / key question / footer CTA all
 *     deterministic, no LLM at render time.
 *   - Action-card body re-uses `TriageActionCardsBody` (same component
 *     `DecisionConfidencePanel` uses) — single source of truth for the
 *     EVPI-ranked queue. The v17 "top" is what differs.
 *   - Right-aligned `IconBtn` cluster per row. Chat prefill via
 *     `useGuidanceStore._prefillChat` / `_sendMessage`. No direct
 *     `addNode` / `addEdge` calls in v1.
 */

import { memo, useMemo, useState, type ReactNode } from 'react'
import {
  Sparkles, MessageCircle, Pencil, Check as CheckIcon, Plus, Flag, FileText,
  ChevronDown, ChevronRight, Check, X,
} from 'lucide-react'
import { typography } from '@/styles/typography'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import type { ResultsVM } from './types'
import { buildAnalysisHeroViewModel } from './analysisHeroV17/buildAnalysisHeroViewModel'
import type {
  AnalysisHeroVM,
  DimensionSegment,
  HeroRow,
  KeyQuestion,
  MetaPill,
  FooterCheck,
  FooterCta,
  AlsoLink,
  RowAction,
} from './analysisHeroV17/analysisHeroVM.types'
import { TriageActionCardsBody } from './TriageActionCardsBody'

// ── Public props ────────────────────────────────────────────────────────────
// Matches `DecisionConfidencePanel` so the substitution in `ResultsBody`
// is a one-line ternary swap. No new prop plumbing through `OutputsDock`.
export interface AnalysisHeroV17Props {
  data: ResultsSectionDataReturn
  vm: ResultsVM
  /** From OutputsDock's local meta — fragile-edge count for state selection. */
  fragileEdgeCount?: number
  verifiedCount?: number
  influenceCoverage?: number
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onSetValue?: (nodeId: string, rawValue: number) => void
  onConfirm?: (nodeId: string) => void
  expertMode?: boolean
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Used by the action-card body's dominant-factor "Research" chip — pass through unchanged. */
  onSendMessage?: (text: string) => void
  aiAffordance?: ReactNode
}

// ── Token + icon mappings ───────────────────────────────────────────────────

const STRIP_FILL_CLASS: Record<DimensionSegment['token'], string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  option: 'bg-option',
}

const ROW_TINT_CLASS: Record<HeroRow['category'], string> = {
  evidence: 'bg-warning/[0.07]',
  risk: 'bg-danger/[0.07]',
  coverage: 'bg-info/[0.07]',
  reflect: 'bg-option/[0.07]',
  causal: 'bg-factor/[0.07]',
  ready: 'bg-success/[0.07]',
}

const CATEGORY_DOT_CLASS: Record<HeroRow['category'], string> = {
  evidence: 'bg-warning',
  risk: 'bg-danger',
  coverage: 'bg-info',
  reflect: 'bg-option',
  causal: 'bg-factor',
  ready: 'bg-success',
}

const PRIORITY_FILL_CLASS: Record<HeroRow['category'], string> = CATEGORY_DOT_CLASS

const META_PILL_CLASS: Record<MetaPill['tone'], string> = {
  neutral: 'border-panel-border text-text-light',
  warn: 'border-warning/45 text-warning',
  danger: 'border-danger/45 text-danger',
  reflect: 'border-option/55 text-option',
}

const FOOTER_CHECK_CLASS: Record<FooterCheck['tone'], string> = {
  ok: 'text-success',
  warn: 'text-warning',
  danger: 'text-danger',
  reflect: 'text-option',
}

const ACTION_ICON: Record<RowAction, { Icon: typeof Sparkles; tooltip: string; variant: Parameters<typeof IconBtn>[0]['variant'] }> = {
  ai: { Icon: Sparkles, tooltip: 'Work through with AI', variant: 'primary' },
  discuss: { Icon: MessageCircle, tooltip: 'Discuss with AI', variant: 'default' },
  edit: { Icon: Pencil, tooltip: 'Edit', variant: 'edit' },
  confirm: { Icon: CheckIcon, tooltip: 'Confirm', variant: 'confirm' },
  add: { Icon: Plus, tooltip: 'Add', variant: 'default' },
  challenge: { Icon: Flag, tooltip: 'Challenge this', variant: 'assume' },
  brief: { Icon: FileText, tooltip: 'Create brief', variant: 'primary' },
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function ReadinessColourStrip({ checkedCount, dimensions }: { checkedCount: string | null; dimensions: DimensionSegment[] }) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="hero-v17-strip">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${typography.panelHeader} text-text-header`}>Strengthen this decision</p>
        {checkedCount && (
          <p className={`${typography.panelMeta} text-text-light truncate`}>{checkedCount}</p>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Decision readiness dimensions">
        {dimensions.map(d => (
          <div
            key={d.label}
            className="h-1.5 rounded-full bg-panel-hover overflow-hidden"
            title={`${d.label}: ${Math.round(d.value * 100)}%`}
            data-testid={`strip-${d.label.toLowerCase()}`}
          >
            <div
              className={`h-full rounded-full ${STRIP_FILL_CLASS[d.token]}`}
              style={{ width: `${Math.round(d.value * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {dimensions.map(d => (
          <span key={d.label} className={`flex items-center gap-1 ${typography.panelMeta} text-text-light truncate`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STRIP_FILL_CLASS[d.token]}`} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function HeroResultContext({ resultLine, reasonLine, metaPills }: {
  resultLine: string; reasonLine: string | null; metaPills: MetaPill[]
}) {
  return (
    <section
      className="rounded-md border border-panel-border p-2.5 flex flex-col gap-1.5"
      aria-label="Result context"
      data-testid="hero-v17-result-context"
    >
      <p className={`${typography.panelHeader} text-text-header`}>{resultLine}</p>
      {reasonLine && <p className={`${typography.panelBody} text-text-body`}>{reasonLine}</p>}
      {metaPills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {metaPills.map(p => (
            <span
              key={p.label}
              className={`inline-flex items-center px-2 py-0.5 rounded-full border ${typography.panelMeta} bg-transparent ${META_PILL_CLASS[p.tone]}`}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function HeroKeyQuestion({ keyQuestion, onPrefillChat }: {
  keyQuestion: KeyQuestion; onPrefillChat: (text: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section
      className="rounded-md border border-panel-border p-2.5 flex flex-col gap-1.5"
      aria-label="Key question"
      data-testid="hero-v17-key-question"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`${typography.panelMeta} text-text-light`}><strong className={`${typography.panelHeader} text-text-header`}>Key question</strong></p>
        {keyQuestion.extras.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            className={`${typography.panelMeta} text-text-light hover:text-info cursor-pointer`}
            data-testid="hero-v17-key-question-toggle"
          >
            {expanded ? 'Hide ▴' : `+${keyQuestion.extras.length} ▾`}
          </button>
        )}
      </div>
      <p className={`${typography.panelHeader} text-text-header`} data-testid="hero-v17-key-question-text">{keyQuestion.text}</p>
      {keyQuestion.chips.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {keyQuestion.chips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => onPrefillChat(`${keyQuestion.text} My answer: ${chip}`)}
              className={`px-2 py-0.5 rounded-full border border-panel-border bg-transparent ${typography.panelMeta} text-text-body hover:border-info hover:text-info focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      {expanded && keyQuestion.extras.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-panel-border" data-testid="hero-v17-extra-questions">
          {keyQuestion.extras.map((q, i) => (
            <p key={i} className={`${typography.panelBody} text-text-body`}>{q}</p>
          ))}
        </div>
      )}
    </section>
  )
}

function HeroActionRow({ actions, chatPrompt, targetNodeId, dispatchAction }: {
  actions: RowAction[]
  chatPrompt: string
  targetNodeId: string | undefined
  dispatchAction: (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => void
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label="Row actions">
      {actions.map(a => {
        const def = ACTION_ICON[a]
        return (
          <IconBtn
            key={a}
            icon={def.Icon}
            tooltip={def.tooltip}
            variant={def.variant}
            onClick={() => dispatchAction(a, { chatPrompt, targetNodeId })}
            ariaLabel={def.tooltip}
          />
        )
      })}
    </div>
  )
}

function HeroInputRows({
  inputRows, hiddenRows, dispatchRowAction,
}: {
  inputRows: HeroRow[]
  hiddenRows: HeroRow[]
  dispatchRowAction: (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (inputRows.length === 0 && hiddenRows.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5" aria-label="Items needing your input" data-testid="hero-v17-input-rows">
      <div className="flex items-center justify-between gap-2">
        <strong className={`${typography.panelHeader} text-text-header`}>Needs your input</strong>
        {hiddenRows.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            className={`${typography.panelMeta} text-text-light hover:text-info cursor-pointer`}
            data-testid="hero-v17-rows-toggle"
          >
            {expanded ? 'Hide ▴' : `+${hiddenRows.length} ▾`}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {inputRows.map(row => <HeroInputRow key={row.key} row={row} dispatchRowAction={dispatchRowAction} />)}
      </div>
      {expanded && (
        <div className="flex flex-col" data-testid="hero-v17-hidden-rows">
          {hiddenRows.map(row => <HeroInputRow key={row.key} row={row} dispatchRowAction={dispatchRowAction} />)}
        </div>
      )}
    </section>
  )
}

function HeroInputRow({ row, dispatchRowAction }: {
  row: HeroRow
  dispatchRowAction: (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => void
}) {
  return (
    <article
      className={`px-2.5 py-2 border-b border-panel-border last:border-b-0 ${ROW_TINT_CLASS[row.category]}`}
      data-testid={`hero-v17-row-${row.category}`}
    >
      <div className="flex items-start gap-2 justify-between">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT_CLASS[row.category]}`} aria-hidden="true" />
            <p className={`${typography.panelHeader} text-text-header truncate min-w-0 flex-1`} title={row.title}>{row.title}</p>
            <span className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light flex-shrink-0`} title="Evidence priority">
              <span className="w-6 h-[3px] rounded-full bg-panel-hover overflow-hidden">
                <span className={`block h-full rounded-full ${PRIORITY_FILL_CLASS[row.category]}`} style={{ width: `${row.priorityWidth}%` }} />
              </span>
              {row.priority}
            </span>
          </div>
          <p className={`${typography.panelBody} text-text-body line-clamp-2`}>{row.reason}</p>
        </div>
        <HeroActionRow
          actions={row.actions}
          chatPrompt={row.chatPrompt}
          targetNodeId={row.targetNodeId}
          dispatchAction={dispatchRowAction}
        />
      </div>
    </article>
  )
}

function HeroFooter({ alsoLinks, footerChecks, footerHint, footerCta, onAlsoClick, onCtaClick }: {
  alsoLinks: AlsoLink[]
  footerChecks: FooterCheck[]
  footerHint: string
  footerCta: FooterCta
  onAlsoClick: (link: AlsoLink) => void
  onCtaClick: () => void
}) {
  return (
    <section className="flex flex-col gap-2 pt-2 border-t border-panel-border" data-testid="hero-v17-footer">
      {alsoLinks.length > 0 && (
        <div className={`flex items-center gap-1.5 flex-wrap ${typography.panelMeta} text-text-light`}>
          <strong className="text-text-header font-semibold">Also:</strong>
          {alsoLinks.map((link, i) => (
            <span key={link.label} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAlsoClick(link)}
                className="text-text-body hover:text-info focus-visible:outline-none focus-visible:underline cursor-pointer"
              >
                {link.label}
              </button>
              {i < alsoLinks.length - 1 && <span aria-hidden="true">·</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className={`flex items-center gap-2 flex-wrap ${typography.panelMeta}`}>
            {footerChecks.map(c => (
              <span key={c.label} className={`inline-flex items-center gap-1 ${FOOTER_CHECK_CLASS[c.tone]}`}>
                {c.tone === 'ok' ? <Check size={11} aria-hidden="true" /> : c.tone === 'reflect' ? <span className="text-[10px]" aria-hidden="true">◌</span> : <X size={11} aria-hidden="true" />}
                {c.label}
              </span>
            ))}
          </div>
          <p className={`${typography.panelMeta} text-text-light`}>{footerHint}</p>
        </div>
        <button
          type="button"
          onClick={onCtaClick}
          className={`px-3 py-1.5 rounded-full bg-primary text-text-on-color border border-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta} font-medium flex-shrink-0`}
          data-testid="hero-v17-footer-cta"
        >
          {footerCta.label}
        </button>
      </div>
    </section>
  )
}

function HeroActionsMenu({ onPrefillChat }: { onPrefillChat: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const items: Array<{ label: string; prompt: string }> = [
    { label: 'Review key inputs with AI', prompt: 'Walk me through the highest-priority inputs one at a time. Ask what I know before suggesting changes.' },
    { label: 'Show evidence gaps', prompt: 'Show only the factors, risks and assumptions where my input would most improve the analysis.' },
    { label: 'Compare my view with Olumi', prompt: 'Compare what I have provided with what Olumi inferred. Highlight the biggest differences.' },
    { label: 'Challenge the current result', prompt: 'Challenge the current result. Make the strongest case for the next closest option.' },
    { label: 'Run a pre-mortem', prompt: 'If the leading option underperformed, what most likely went wrong?' },
    { label: 'Use the outside view', prompt: 'Ask what comparable decisions I know, then help me reason from base rates.' },
  ]
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-panel-border bg-panel hover:bg-panel-hover ${typography.panelMeta} text-text-body cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
        data-testid="hero-v17-actions-toggle"
      >
        Actions
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 w-56 p-1.5 rounded-md border border-panel-border bg-panel shadow-panel z-20"
          data-testid="hero-v17-actions-menu"
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { onPrefillChat(item.prompt); setOpen(false) }}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left ${typography.panelBody} hover:bg-panel-hover focus-visible:outline-none focus-visible:bg-panel-hover`}
            >
              <Sparkles size={11} className="text-info flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Action dispatcher ───────────────────────────────────────────────────────

interface DispatchInputs {
  prefillChat: (text: string) => void
  sendMessage: (text: string) => void
  onFocusNode: ((nodeId: string) => void) | undefined
  onConfirm: ((nodeId: string) => void) | undefined
}

function makeRowActionDispatcher({ prefillChat, sendMessage, onFocusNode, onConfirm }: DispatchInputs) {
  return (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => {
    const { chatPrompt, targetNodeId } = payload
    switch (action) {
      case 'ai':
      case 'discuss':
      case 'add':
      case 'challenge':
      case 'brief':
        // v1 — every secondary action is chat prefill. No direct mutation.
        prefillChat(chatPrompt)
        return
      case 'edit':
        if (targetNodeId && onFocusNode) onFocusNode(targetNodeId)
        else prefillChat(chatPrompt)
        return
      case 'confirm':
        if (targetNodeId && onConfirm) onConfirm(targetNodeId)
        else prefillChat(chatPrompt)
        return
    }
    // Unreachable — keeps the dispatcher exhaustive at compile time
    // without leaking a fallback that silently no-ops.
    void sendMessage
  }
}

// ── Main exported component ─────────────────────────────────────────────────

export const AnalysisHeroV17 = memo(function AnalysisHeroV17({
  data,
  vm,
  fragileEdgeCount,
  verifiedCount: _verifiedCount,
  influenceCoverage: _influenceCoverage,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  expertMode: _expertMode,
  nodeValueLookup,
  onSendMessage,
  aiAffordance,
}: AnalysisHeroV17Props) {
  // Provenance-grounded inputs: factor count + confirmed-factor count from
  // the canvas store. Verified bar uses these per investigation §5.3 /
  // brief §3 step 9.
  const confirmedFactorCount = useCanvasStore(s => {
    if (!s.confirmedNodeIds || !s.nodes) return 0
    const factorIds = new Set(s.nodes.filter(n => n.type === 'factor').map(n => n.id))
    let count = 0
    s.confirmedNodeIds.forEach(id => { if (factorIds.has(id)) count += 1 })
    return count
  })
  const totalFactorCount = useCanvasStore(s => s.nodes?.filter(n => n.type === 'factor').length ?? 0)

  const heroVm = useMemo(
    () => buildAnalysisHeroViewModel({
      data,
      vm,
      confirmedFactorCount,
      totalFactorCount,
      fragileEdgeCount: fragileEdgeCount ?? 0,
    }),
    [data, vm, confirmedFactorCount, totalFactorCount, fragileEdgeCount],
  )

  // Chat-prefill + send wires. Read from guidance store at dispatch time so
  // a re-registration after ConversationPanel mounts is picked up cleanly.
  const prefillChat = (text: string) => {
    const p = useGuidanceStore.getState()._prefillChat
    if (p) p(text)
    else {
      // Fallback: auto-send rather than swallow the user intent.
      const s = useGuidanceStore.getState()._sendMessage
      if (s) s(text)
    }
  }
  const sendMessage = (text: string) => {
    const s = useGuidanceStore.getState()._sendMessage
    if (s) s(text)
    else prefillChat(text)
  }

  const dispatchRowAction = useMemo(
    () => makeRowActionDispatcher({ prefillChat, sendMessage, onFocusNode, onConfirm }),
    // prefillChat / sendMessage are stable references via getState; only
    // re-bind when external handlers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFocusNode, onConfirm],
  )

  const handleAlsoClick = (link: AlsoLink) => {
    prefillChat(link.chatPrompt)
  }

  // State-dependent CTA. Moderate state focuses the factor first, then prefills.
  // Reflect state auto-sends. All others prefill only. (Investigation §11.4.)
  const handleCtaClick = () => {
    const cta = heroVm.footerCta
    if (cta.kind === 'check-key-estimate') {
      if (cta.focusTargetId && onFocusNode) {
        // Focus is synchronous — fire it first, then prefill in the same
        // call stack. No setTimeout, no sleeps. (Brief §3 step 6.)
        onFocusNode(cta.focusTargetId)
      }
      prefillChat(cta.chatPrompt)
      return
    }
    if (cta.kind === 'challenge-result') {
      sendMessage(cta.chatPrompt) // reflect state — auto-send is approved
      return
    }
    // weak / strong: prefill only.
    prefillChat(cta.chatPrompt)
  }

  return (
    <div className="space-y-4 animate-fade-in" data-testid="analysis-hero-v17">
      <div
        className="rounded-lg border border-panel-border bg-panel p-3 space-y-3"
        data-testid="analysis-hero-v17-card"
      >
        {/* Top: header + dimension strip + Actions menu */}
        <header className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <ReadinessColourStrip
              checkedCount={heroVm.checkedCount}
              dimensions={heroVm.dimensions}
            />
            {heroVm.contribution.text && (
              <p className={`mt-1.5 ${typography.panelMeta} text-text-light`} data-testid="hero-v17-contribution">
                {heroVm.contribution.text}
              </p>
            )}
          </div>
          <HeroActionsMenu onPrefillChat={prefillChat} />
        </header>

        <HeroResultContext
          resultLine={heroVm.resultLine}
          reasonLine={heroVm.reasonLine}
          metaPills={heroVm.metaPills}
        />

        {heroVm.keyQuestion && (
          <HeroKeyQuestion keyQuestion={heroVm.keyQuestion} onPrefillChat={prefillChat} />
        )}

        <HeroInputRows
          inputRows={heroVm.inputRows}
          hiddenRows={heroVm.hiddenRows}
          dispatchRowAction={dispatchRowAction}
        />

        <HeroFooter
          alsoLinks={heroVm.alsoLinks}
          footerChecks={heroVm.footerChecks}
          footerHint={heroVm.footerHint}
          footerCta={heroVm.footerCta}
          onAlsoClick={handleAlsoClick}
          onCtaClick={handleCtaClick}
        />

        {/* Action-card body — same component DecisionConfidencePanel uses.
            v17 stacks it BENEATH the new hero structure within the same card,
            so the existing top-3 EVPI-ranked queue + flip-risk + dominant
            nudge + checks footer remain available to users without drift. */}
        <TriageActionCardsBody
          data={data}
          onFocusNode={onFocusNode}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          onSetValue={onSetValue}
          onConfirm={onConfirm}
          nodeValueLookup={nodeValueLookup}
          onSendMessage={onSendMessage}
          aiAffordance={aiAffordance}
        />
      </div>
    </div>
  )
})

export default AnalysisHeroV17
