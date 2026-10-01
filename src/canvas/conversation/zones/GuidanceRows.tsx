/**
 * T4 — the coaching row under the latest assistant turn (Reasoning Coach @1c355d57; carrier AI HARNESS 5937532945).
 *
 * The row's words are the WIRE's (`copy.title` / `why` / `question`); this file authors none. M1's row IS
 * "Olumi surfaced the challenge". Its ONE action (RC `card_first.ui_path`) is the SERVED Reasoning-tab control for the
 * row's link (#2408 `UnsizedLinkRow`: Accept = proposeEdgeStrengthConfirmation, Edit = openEdgeStrengthEditor), bound
 * by `item_ref` ids, never by parsing `item`. Same authority, 0 LLM.
 *
 * ⛔ The action is offered only where #2408 offers it: an S1 `RC-STRENGTHEN-ITEM` row whose link is on the canvas,
 *   still unsized (`isStrengthPlaceholder`), on an affirmatively current Run (`selectRunAffirmedCurrent`). Otherwise
 *   the row is the challenge's words alone, never a button that would act on the wrong link or a stale Run.
 */
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { isStrengthPlaceholder } from '../../domain/strengthPlaceholder'
import { UnsizedLinkRow } from '../../../components/results/analysisNew/sections/UnsizedLinkActions'
import { action } from '../../../components/results/analysisNew/panelSurfaces'
import { focusEdgeByEndpoints, focusNodeById } from '../../utils/focusHelpers'
import { PANEL_LIST_CONTROLS } from '../panelLists'
import { STRENGTHEN_ITEM_POLICY, type GuidanceItemRef, type GuidanceRow, type TurnGuidance } from '../guidanceRows'

/** Every node the ref names is on this canvas (a link: BOTH ends). A dangling edge is not "on the canvas". */
function refOnCanvas(ref: GuidanceItemRef | null, ids: ReadonlySet<string>): boolean {
  if (ref === null) return false
  return ref.kind === 'link' ? ids.has(ref.fromId) && ids.has(ref.toId) : ids.has(ref.factorId)
}

function useRefOnCanvas(ref: GuidanceItemRef | null): boolean {
  return useCanvasStore((s) => refOnCanvas(ref, new Set(s.nodes.map((n) => n.id))))
}

function nodeLabel(id: string): string {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  const label = (node?.data as { label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.trim() !== '' ? label : id
}

/** The canvas edge an S1 strengthen row acts on, when #2408's own gates would offer it; else null. */
function useStrengthenLink(row: GuidanceRow): { edgeId: string; fromLabel: string; toLabel: string } | null {
  const ref = row.policyId === STRENGTHEN_ITEM_POLICY && row.variant === 'S1' && row.itemRef?.kind === 'link' ? row.itemRef : null
  const current = useCanvasStore(selectRunAffirmedCurrent)
  const ends = useRefOnCanvas(ref)
  const edge = useCanvasStore((s) => (ref ? s.edges.find((e) => e.source === ref.fromId && e.target === ref.toId) ?? null : null))
  if (!ref || !ends || !edge || !current || !isStrengthPlaceholder(edge.data)) return null
  return { edgeId: edge.id, fromLabel: nodeLabel(ref.fromId), toLabel: nodeLabel(ref.toId) }
}

function GuidanceRowCard({ row, testId }: { row: GuidanceRow; testId: string }) {
  const link = useStrengthenLink(row)
  // Show the row's subject on the canvas through the EXISTING focus handlers, by id; reads nothing back, writes nothing.
  const showable = useRefOnCanvas(row.itemRef)
  const ref = row.itemRef
  return (
    <div
      className="mt-2 rounded-lg border border-panel-border p-3"
      data-testid={testId}
      data-policy={row.policyId}
      data-has-action={link ? 'true' : 'false'}
    >
      <p className={`${typography.chatBody} font-medium text-text-header`} data-testid={`${testId}-title`}>{row.copy.title}</p>
      {row.copy.why && <p className={`${typography.chatMeta} mt-1 text-text-light`} data-testid={`${testId}-why`}>{row.copy.why}</p>}
      {row.copy.question && <p className={`${typography.chatBody} mt-1 text-text-body`} data-testid={`${testId}-question`}>{row.copy.question}</p>}
      {showable && ref && (
        <button
          type="button"
          className={`${typography.chatMeta} ${action('quiet')} mt-1 text-text-light hover:text-text-header`}
          data-testid={`${testId}-show`}
          onClick={() => (ref.kind === 'link' ? focusEdgeByEndpoints(ref.fromId, ref.toId, ref.toId) : focusNodeById(ref.factorId))}
        >
          Show on canvas
        </button>
      )}
      {link && (
        <div className="mt-2">
          <ul className={PANEL_LIST_CONTROLS}>
            <UnsizedLinkRow link={link} testId={`${testId}-link`} />
          </ul>
        </div>
      )}
    </div>
  )
}

export function GuidanceRows({ guidance }: { guidance: TurnGuidance }) {
  return (
    <div data-testid="guidance-rows">
      {guidance.slot1 && <GuidanceRowCard row={guidance.slot1} testId="guidance-row-slot1" />}
      {guidance.slot2 && <GuidanceRowCard row={guidance.slot2} testId="guidance-row-slot2" />}
    </div>
  )
}
