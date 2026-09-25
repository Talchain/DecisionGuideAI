import { memo, useCallback, type ReactNode } from 'react'
import { MessageCircle, MoreHorizontal, Pencil, Zap } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { openNodeInspector } from './openNodeInspector'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useShowToastSafe } from '../../ToastContext'
import { askAI, buildAskAIPrompt, CHALLENGE_KINDS } from '../../contextMenu/actions'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import type { NodeType } from '../../domain/nodes'
import Tooltip from '../../../components/Tooltip'
import {
  CANVAS_GAP_CLASSES,
  CANVAS_CORNER_INSET_CLASSES,
  CANVAS_QUICK_ACTION_INSET_PX,
} from './canvasGlyphScale'
import { NodeCoachingIcon, useCoachingIconChip } from './NodeCoachingIcon'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX } from './nodeCardRailStyles'
import type { ResolvedCoaching } from '../coaching/resolveNodeCoaching'

/**
 * Does this node type have a generative prompt to offer?
 *
 * ⭐ DERIVED, NEVER MIRRORED — the principle is unchanged and it is what made
 * this a one-line change. A hand-copied list here would drift the first time a
 * kind joined or left the gate, and the drift would read as green.
 *
 * WHAT MOVED (8 Sep 2026). This used to read
 * `FULL_MENU_KINDS.has(nodeType) || nodeType === 'goal'`, deriving from the
 * menu. It now derives from `CHALLENGE_KINDS` in the PRODUCER, which is one
 * step closer to the fact it was reaching for: a kind is challengeable exactly
 * when `buildAskAIPrompt` can build a challenge for it. The `|| 'goal'`
 * epicycle — the one fragment that really was hand-copied into both files —
 * disappears into the Set.
 *
 * ⚠ THE PARAGRAPH THAT USED TO CLOSE THIS BLOCK IS FALSE AND IS REPLACED. It
 * read: *"The organisational kinds (`decision`, `option`, `constraint`) get NO
 * button: the menu builds no challenge prompt for them, so a control here would
 * open nothing. An affordance that opens nothing is worse than no affordance."*
 * The producer now builds kind-appropriate copy for all three, so the control
 * opens onto a real prompt, a live composer and an ordinary CEE turn carrying
 * the node's kind in `selected_elements`. The PRINCIPLE in that last sentence
 * stands and still governs the gate — `action` is held out on exactly it. The
 * fact underneath it does not, and it is quoted rather than deleted because a
 * comment that outlives its truth is what teaches the next reader to stop
 * checking.
 */
function hasChallengePrompt(nodeType: NodeType): boolean {
  return CHALLENGE_KINDS.has(nodeType)
}

/**
 * ⭐ THE EDIT ROUTE IN THE RAIL — design-gap row 20, contract v3 §02 (VC-01):
 * `if(['question','goal','factor','option'].includes(n.kind)&&!n.baseline)
 *    rail += tooltipButton('edit', …, 'revealed')` — "The existing edit route is
 * shown on hover/focus where the real carrier exists", and "Do not advertise
 * unsupported risk/outcome editors." So Outcome and Risk get coaching only.
 *
 * ⚠ OPTION IS NOT IN THIS SET, AND THAT IS NOT AN OMISSION. The option card
 * already owns its edit route — the rail pencil `option-edit-targets-<id>`,
 * passed in as a resting member and gated on the two facts this row cannot
 * see: `!isBaselineOption` (the contract's `!n.baseline`) and
 * `OPTION_TARGETS_ROUTE_IS_LIVE` (the carrier). A second pencil here would
 * duplicate it on every option and reappear on the baseline, where the
 * contract draws none. That pencil now takes `reveal`, so all four families
 * show the route on hover/focus only.
 *
 * WHERE IT GOES: `openNodeInspector` — the route "Open details" in the More
 * menu and the option pencil already take. At this tip every one of the three
 * panels owns a live carrier or a live header: the rename in the inspector
 * header (`updateNodeLabel` → `structural_rename`) for all three, plus
 * `factor_value_edit` on every factor pane and `proposeGoalTarget` on the goal
 * pane (`AUTHORITY_OWNING_PANELS`, `InspectorRouter.tsx`). No new surface; and
 * the click itself writes nothing, so it can never read as a save.
 */
const RAIL_EDIT_ROUTE_KINDS: ReadonlySet<NodeType> = new Set<NodeType>(['decision', 'goal', 'factor'])

/**
 * NodeQuickActions — the contextual efficiency layer (R5, Paul, 16 Aug 2026).
 *
 * "nodes/edges carry a compact CONTEXTUAL EFFICIENCY LAYER — small clickable
 * icons and/or a hover menu giving one-click access to (a) ask Olumi about
 * THIS element and (b) open the precise analysis lens for THIS element —
 * powerful science-grounded shortcuts for practised users, balanced against
 * clutter. Full functionality stays in the inspector and may be DUPLICATED
 * there. Full buttons/instructional text on nodes: no. Efficiency principle:
 * minimise clicks to power functionality; nothing buried. Every hover action
 * has a click/tap/keyboard equivalent."
 *
 * Design notes, each answering a constraint from that ruling:
 *
 * - QUIET AT REST. Hidden by opacity, revealed on hover, on keyboard focus
 *   within the card, and whenever the node is SELECTED. Selection is what
 *   makes this reachable without a pointer at all: select with the keyboard,
 *   the actions appear, Tab to them.
 * - CLICK/TAP/KEYBOARD PARITY. Native <button>s, so Tab and Enter/Space work
 *   with no key handling of our own. `group-focus-within` keeps them visible
 *   while they hold focus — without it, a focused button would be invisible,
 *   which is the exact "hover action with no keyboard equivalent" the ruling
 *   forbids. Reveal is opacity-only, never `display`/`hidden`, so the buttons
 *   stay in the tab order and in the accessibility tree at rest.
 *   Touch devices (`pointer: coarse`) get them permanently visible: a touch
 *   device has no hover, so opacity-on-hover would be a tap target that never
 *   appears. So does a SELECTED node, via `alwaysVisible`.
 * - THREE SHORTCUTS. Ask and Challenge keep their existing conversation
 *   routes; More opens the existing node menu. Selecting the node opens its
 *   inspector, so a fourth inspector button would duplicate that route.
 *   ⚠ SUPERSEDED FOR QUESTION / GOAL / FACTOR by contract v3 §02 (row 20): the
 *   contract draws an explicit, revealed EDIT icon in the rail, because a click
 *   on the card is not a discoverable edit affordance. It is that same
 *   inspector route, not a new one — see `RAIL_EDIT_ROUTE_KINDS`.
 * - POSITIONED TOOLTIPS. Tooltip attaches to the button itself, preserving
 *   the hit area and accessible name. usePopoverHover suppresses the node
 *   preview while this row is hovered or focused, so the two cannot overlap.
 * - NO DEAD CONTROLS, AND NO SILENT ONES. The ask button renders only when a
 *   surface that can RECEIVE an ask is registered (`canReceiveAsk`, the
 *   question `askAI` itself asks), and the click passes `showToast` through so
 *   a channel that dies between render and click surfaces as a message rather
 *   than as nothing. A review once caught the gate asking a different question
 *   from `askAI` (then: the SEND channel); the rule — gate on what the click
 *   needs — is unchanged, only what the click needs has moved (24 Sep 2026).
 *
 * `stopPropagation` is deliberate and, unlike the dead on-node pencil this
 * replaces, harmless: these buttons perform the selection themselves, so
 * suppressing the node click costs nothing.
 *
 * ⚠ PLACEMENT IS LOAD-BEARING — bottom-right, not top-right. The node's
 * TOP-right is an explicitly OWNED band: `node-corner-stack` sits at
 * `-top-2 -right-2 z-10` and exists precisely because three badges used to
 * collide there (a browser-confirmed P2 fix). This layer first shipped at
 * `top-1.5 right-1.5 z-[2]` — about 6px inside that band and at a LOWER z, so
 * the stack painted over these buttons whenever a rank badge, freshness dot or
 * coaching marker was present. Bottom-right is unowned once ActionIcons' single
 * Confirm icon moves to bottom-LEFT, which it has. The geometry is pinned in
 * this component's spec: change it there too, or leave it alone.
 */
/**
 * Shared button geometry, counter-scaled so a control keeps its AUTHORED size
 * at any zoom (#1274). Replaces three identical inline class strings: the box
 * (`CANVAS_GLYPH_SIZE_CLASSES[20]`) and the hit-slop (`CANVAS_HIT_SLOP_CLASSES[2]`)
 * are the two terms the footprint bound in `canvasGlyphTargetScale.spec.tsx`
 * reads, so a literal here would be a second, undetected authority.
 */
/**
 * ⭐ THE PX ARE NOW CONSTANTS, AND THE CARD READS THEM.
 *
 * `20` and `2` were literals at these two indices. They are the same two numbers
 * `NODE_QUICK_ACTION_BAND_PX` uses to size the bottom band `BaseNode` reserves
 * for this row — and while they lived only here, that band was a hand-copy that
 * had already drifted (24 against a required 26) and then drifted 26px further
 * when #1274 scaled the box and the slop. Indexing the maps by the shared
 * constant means the row and its reservation cannot disagree: change the box
 * size and the card makes room for the new one.
 */
/**
 * ⭐ AND NOW THEY ARE THE RAIL'S OWN CLASSES, NOT A PRIVATE COPY — contract v3.1
 * `.icon-btn` (deltas ICON-01 / FRAME-11 / OPT-13 / F12). This file kept its own
 * string after `nodeCardRailStyles.ts` became the rail's one geometry, and the
 * copy had drifted: no `nopan`/`shrink-0`, and a hover to `text-text-body` on
 * `bg-panel-hover` while the coaching icon in the same row hovered to Info. So a
 * revealed rail showed two hover languages and two glyph sizes. One string now,
 * muted at rest; the box and the slop are the same constants, so the band
 * `BaseNode` reserves is unchanged.
 */
const BUTTON_CLASSES = `${NODE_RAIL_BUTTON_CLASSES} text-text-light`

export interface NodeQuickActionsProps {
  nodeId: string
  nodeType: NodeType
  /** The node's label, used in the button's accessible name. */
  label: string
  /** Keep the actions visible regardless of hover — used when the node is
   *  selected, which is what gives a keyboard-only user a way to reach them. */
  alwaysVisible?: boolean
  /**
   * ⭐ THE RAIL'S RESTING MEMBERS (locked Canvas design, spec §2 "Bottom rail is
   * one consistent location for icons/actions"). Persistent data icons — the
   * evidence and behaviour cues, a provenance exception — rendered ALWAYS, to
   * the left of the coaching icon. Each caller renders only what its data says
   * applies (spec §2: "Persistent status/data icons render only when
   * informative").
   */
  restingIcons?: ReactNode
  /**
   * ⭐ S5 (24 Sep): WHERE THE RAIL SITS. `inset` (default) — inside the card's
   * bottom band, at Normal zoom, as the contract draws it. `below` — BELOW the
   * card, over the row gap, at the landing rung, where the card reserves no
   * band: the hover actions (point 6's landing-rung ask door) still appear on
   * hover/focus/selection, and the card is not taller for them. Still a DOM
   * child of the card, so hovering it keeps the card's `group-hover`.
   */
  placement?: 'inset' | 'below'
  /**
   * The card's coaching resolution. When it yields a question, the ONE coaching
   * icon is the rail's rightmost resting member and the hover-only "Ask Olumi"
   * button is withheld — ED 02:31Z (D4): the quick actions "expand/replace
   * around it, not duplicate 'Ask Olumi'".
   */
  coaching?: ResolvedCoaching
}

export const NodeQuickActions = memo(function NodeQuickActions({
  nodeId,
  nodeType,
  label,
  alwaysVisible = false,
  restingIcons,
  coaching = null,
  placement = 'inset',
}: NodeQuickActionsProps) {
  const coachingChip = useCoachingIconChip(nodeId, coaching)
  // The gate must ask the question `askAI` actually asks. It polls for
  // `canReceiveAsk` and hands the prompt to `requestAsk` (composer, else the
  // Ask drawer), giving up with a toast if no surface ever registers.
  //
  // ⚠ THIS USED TO READ `_sendMessage !== null`, and was right to while
  // `askAI` SENT: a prefill-only surface would have shown a dead button. Now
  // that `askAI` drafts, that gate would HIDE a working one on a prefill-only
  // host — the same trap-21 mismatch pointing the other way.
  const canAsk = useGuidanceStore(canReceiveAsk)
  // …and if the channel dies between the render and the click, the user is told
  // rather than left with a button that did nothing. `Safe` because nodes also
  // render in headless hosts, where a missing ToastProvider must not throw.
  const showToast = useShowToastSafe()

  const handleAsk = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId)
    if (!node) return
    askAI(
      { kind: 'node', nodeId, nodeType, node, screenPos: { x: 0, y: 0 } },
      'explain_element',
      showToast,
    )
  }, [nodeId, nodeType, showToast])

  /**
   * ⭐⭐ THE GENERATIVE PROMPT GETS A DOOR.
   *
   * ## What was actually buried
   *
   * This layer shipped with ONE conversational shortcut, and the prompt behind
   * it is `explain_element`: *"Explain the role of X in this decision model."*
   * That is a REPORTING question — it describes what is already on the card.
   * The product's one node-scoped GENERATIVE prompt, `challenge_element`
   * (*"Challenge the current setup of X. What could be wrong or missing?"*),
   * had no button: its only doors were RIGHT-CLICK → Ask AI ▸ Challenge this,
   * and the overflow button beside this one, which re-emits that right-click.
   * Both land it two levels inside a menu, and right-click has no equivalent
   * gesture on a touch device.
   *
   * So the layer built to unbury this node's power picked the reporting prompt
   * and left the generating one buried. That is the standing critique of this
   * canvas — every element is a conclusion, nothing generates — reproduced
   * inside the fix for it. This is the third entry, and it is a peer of the
   * ask, not overflow: it is the half that suggests what is MISSING rather
   * than scoring what is there.
   *
   * ## Why `requestAsk` and NOT `askAI`
   *
   * `askAI` — which the sibling ask button uses — polls for `_sendMessage` and
   * DISPATCHES. That is tolerable for "explain this", which asks the model to
   * describe something the user already has. It is wrong here: a challenge
   * produces ideas the user has not agreed to, and the house rule
   * (`askSemantic.ts`, `ASK_SEMANTIC = 'prefill-and-confirm'`) is that an ask
   * lands an EDITABLE DRAFT in a visible surface and the user presses Send.
   * Humans stay the authors of what enters their own model.
   *
   * ⚠ AND THE SEAM THIS LEFT OPEN, stated rather than hidden: the button
   * beside this one still auto-sends, so two adjacent controls in one layer now
   * confirm differently. That is trap 21 in miniature and I am NOT closing it
   * here — `askAI` has seven call sites and every context-menu ask rides it, so
   * migrating it changes the whole menu's behaviour and needs its own review.
   * The smallest enabling change is to route `askAI`'s step 3 through
   * `requestAsk`; it is reported, not smuggled into this PR.
   *
   * ⭐ CLOSED 24 Sep 2026, by exactly that change: `askAI`'s step 3 now calls
   * `requestAsk`, so the ask button, this one and every context-menu ask all
   * land a draft (`askAIPrefillNeverSends.spec.tsx`). This button keeps its own
   * `requestAsk` call because it carries a label and source of its own.
   *
   * ## Why it selects first
   *
   * `askAI` selects the element before sending so the turn carries
   * `selected_elements` — the context the prompt's text alone does not supply.
   * Dropping that would make this button's answer worse than the menu's for the
   * same question, so the selection step is reproduced deliberately. It is the
   * one line of `askAI` worth having without the send.
   */
  const canChallenge = useGuidanceStore(canReceiveAsk) && hasChallengePrompt(nodeType)

  const handleChallenge = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId)
    if (!node) return

    // Same ordering as `askAI`: select, THEN ask, so the turn carries the
    // element rather than a bare sentence about it.
    useCanvasStore.getState().selectNodeWithoutHistory(nodeId)

    const text = buildAskAIPrompt(
      { kind: 'node', nodeId, nodeType, node, screenPos: { x: 0, y: 0 } },
      'challenge_element',
    )
    const landed = requestAsk({
      text,
      label: `Challenge ${label}`,
      targetId: nodeId,
      source: 'node-quick-actions',
    })
    // The gate is checked at render; a channel can still die between render and
    // click. `requestAsk` returning 'none' is that case, and it must surface as
    // a message rather than as a button that did nothing — the same discipline
    // the ask button's toast enforces.
    if (landed === 'none') {
      showToast?.('Could not open a draft — try typing your question directly.', 'warning')
    }
  }, [nodeId, nodeType, label, showToast])

  /**
   * Open this node's own menu — the SAME menu right-click opens, by the same
   * code path.
   *
   * ## The gap this closes
   *
   * ⚠ THIS LIST WAS WRONG WHEN FIRST WRITTEN, THEN THE CORRECTION WENT STALE,
   * AND BOTH ARE KEPT BECAUSE THE PAIR IS THE LESSON. It first named six
   * invitations including "Add risk from this", "Add outcome from this" and
   * "Add connected factor". The correction said **none of which can render, for
   * any node type, in any state** — all three stripped by
   * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` because `canvasSemanticMutations` is
   * `'disabled'`, "test-locked as a permanent audit rather than a runtime
   * toggle". That was true when written and is **FALSE as of 18 Sep 2026**: the
   * three ids moved to `CONNECTED_NODE_ADD_MENU_IDS`, judged by the node and
   * edge add carriers, and they render and are actionable on every non-constraint
   * node. **The original list was right about them all along; it was simply four
   * months early.** ⭐ Note what "test-locked as a permanent audit" did here: it
   * described a derived audit that ITERATES the set, which can only ever prove
   * the filter agrees with the set — never that the set is right. Calling it
   * permanent is what made this comment sound settled.
   *
   * WHAT THIS BUTTON ACTUALLY UNBURIES, derived rather than recalled — ⚠ and
   * now SHORT BY THREE, for the reason above: "Add connected factor", "Add
   * outcome from this" and "Add risk from this" rejoined the menu on 18 Sep 2026.
   * Re-derive this list at your tip rather than quoting it; it has been wrong in
   * both directions already.
   * "Challenge this" (gated `CHALLENGE_KINDS`), "Explore ▸ Trace to goal" and
   * "Select path to goal" (gated `isFull`), "Explain this", Copy and Delete —
   * plus two Graph Lens items, "Isolate this option's paths"
   * (`lens-isolate-option`, option nodes) and "Show sensitivity view"
   * (`lens-sensitivity`, factor nodes carrying `factor_sensitivity`), both
   * post-analysis and both behind `isGraphLensEnabled()`
   * (`contextMenu/useMenuItems.ts:470-500`).
   *
   * ⚠ THE LIST ABOVE WAS SHORT BY THOSE TWO, WHICH IS THE SAME DEFECT AS THE
   * ONE THIS BLOCK OPENS BY CONFESSING. The first version named three
   * invitations that cannot render; the correction then omitted two that can.
   * Over-claiming and under-claiming are the same failure — a list in shipped
   * source that does not match what the code produces — and I made both in one
   * comment, having written "derived rather than recalled" above it.
   *
   * ⚠ AND WHAT I STILL CANNOT SAY: whether those two are on for a real user.
   * `VITE_FEATURE_GRAPH_LENS` is absent from `netlify.toml`, so its deployed
   * value is a Render/Netlify dashboard question and not derivable from this
   * tree (CLAUDE.md trap 18 — YAML is not the deployed env). They are
   * unstripped and reachable BY CONSTRUCTION when the flag is on; that is the
   * precise claim, and "the menu contains them by default" is not.
   *
   * Until this button there were exactly two doors to them: RIGHT-CLICK, which
   * has no equivalent on a touch device, and SHIFT+F10, which nobody discovers.
   * So the part of the product that invites a team to challenge its model was,
   * in practice, unreachable — not disabled, not missing, just behind a
   * gesture. The ruling this component implements says "nothing buried".
   *
   * ⚠ AND ONE LIMIT THE RATIONALE MUST NOT DENY: this whole layer unmounts at
   * low zoom (`showQuickActions = !lodBodyHidden && …`, `BaseNode.tsx`), which is a
   * plausible touch posture. Right-click still works there, so it is a gap
   * rather than a regression — but the button does not reach every state the
   * argument for it implies, and saying so here is cheaper than the next reader
   * discovering it.
   *
   * ## Why it DISPATCHES a contextmenu event rather than calling a handler
   *
   * The menu's target is assembled in `ReactFlowGraph.onNodeContextMenu`, which
   * also handles multi-selection and selects the node when it is not already
   * selected. Reaching in to call that would mean either lifting a callback
   * through every node type or duplicating the target-assembly here — and a
   * second assembler is how two authorities on one question get created
   * (CLAUDE.md trap 21). Re-emitting the event React Flow already listens for
   * means this button CANNOT diverge from right-click: there is one handler,
   * one target shape, one menu. If right-click's behaviour changes, this
   * changes with it, including any gating added later.
   *
   * ⚠ `bubbles: true` IS LOAD-BEARING, not boilerplate. React attaches its
   * listeners at the root container, so a non-bubbling dispatch would reach
   * nothing at all and the button would be silently inert — a dead control,
   * which is the specific failure this component's own header records catching
   * once already.
   *
   * Coordinates are the button's own bottom-right corner, so the menu opens
   * where the finger or cursor already is rather than at the node's origin.
   */
  const handleOpenMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    el.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.right),
        clientY: Math.round(rect.bottom),
      }),
    )
  }, [])

  const stopPointer = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  // Row 20: the edit route. `openNodeInspector` selects THIS node and raises
  // the inspector, fail-closed on a stale id; it writes nothing to the graph.
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openNodeInspector(nodeId)
  }, [nodeId])
  const hasEditRoute = RAIL_EDIT_ROUTE_KINDS.has(nodeType)

  /**
   * ⭐⭐ TOOLTIP COPY AND ACCESSIBLE NAME ANSWER DIFFERENT QUESTIONS.
   *
   * All three tooltips used to carry the node's own label — "Ask Olumi about
   * {label}", "Challenge {label} — what could be wrong or missing?", "More
   * actions for {label} — the same menu as right-click". Each was accurate.
   * Together they were the wrong instrument for the surface:
   *
   *  - THE LABEL IS UNBOUNDED. A node title clamps to two lines on the card and
   *    is recoverable in full from the inspector; a tooltip has neither clamp.
   *    An option named by a real team ("Raise Pro from £49 to £59 alongside the
   *    Q3 feature release") produced a hover box wider than the node, painted
   *    over the card the pointer is resting on — the thing you hovered to act
   *    on. Tooltip.tsx caps at `max-w-[200px]` and wraps, so long labels bought
   *    HEIGHT instead: a tall block, still over the node.
   *  - THE ANSWER WAS ALREADY ON SCREEN. The label is on the card, two
   *    centimetres away, and the pointer is inside that card. Repeating it in
   *    the hint spends the whole box restating context the reader has and
   *    leaves the button's own meaning to be inferred from an icon.
   *  - IT IS NOT THE ACCESSIBLE NAME'S JOB. A screen-reader user reaching these
   *    buttons by Tab has NO spatial context, so `aria-label` must carry the
   *    node identity and does — unchanged, all three. The two strings are
   *    deliberately different because the two audiences hold different context,
   *    and collapsing them is what made the sighted hint redundant.
   *
   * So: the visible hint says what the BUTTON does; the accessible name says
   * which NODE it acts on. Routing, the 300 ms delay and the counter-scaled
   * geometry (#1274) are untouched.
   *
   * ⚠ ONE BRANCH, NOT A KIND→NOUN MAP. "this option" reads better than "this
   * node" on the surface this layer was designed for, and every other
   * challengeable kind takes the generic word. A full spelling table already has
   * three claimants in this repo (`NODE_REGISTRY`, `getTypeLabel`, `KIND_LABEL`
   * — see `domain/vocabulary.ts`), and a fourth partial one added here for a
   * two-way choice would be a fourth loose literal in a file whose header exists
   * to stop exactly that.
   */
  const challengeHint = nodeType === 'option' ? 'Challenge this option' : 'Challenge this node'

  return (
    <div
      /* ⭐ THE CARD RAIL (locked Canvas design, 23 Sep 2026). ONE row in the band
         BaseNode already reserves (`NODE_QUICK_ACTION_BAND_PX`), anchored at the
         quick actions' own corner inset. Left: the hover/focus-only quick
         actions (unchanged, with their opacity/pointer-events mirror). Right:
         the RESTING members — data icons, then the coaching icon rightmost — so
         at rest the visible icons sit flush at the corner and the hover group
         appears to their left without moving them (ED 02:31Z D4: "No layout
         jump").

         The wrapper itself never hit-tests (`pointer-events-none`); the resting
         group opts back in, and the hover group keeps its mirror. */
      className={`node-card-rail absolute ${placement === 'below' ? 'top-full right-0' : CANVAS_CORNER_INSET_CLASSES[CANVAS_QUICK_ACTION_INSET_PX]} z-[2] flex items-center ${CANVAS_GAP_CLASSES[6]} pointer-events-none`}
      data-testid={`node-card-rail-${nodeId}`}
      data-rail-placement={placement}
    >
    <div
      /* ⭐ THE `pointer-events` SET MIRRORS THE `opacity` SET, 1:1, AND THE
         MIRROR IS LOAD-BEARING — do not "tidy" it into a different spelling.

         `opacity: 0` hides an element; it does NOT stop it hit-testing. Without
         the mirror this row is an invisible strip across the bottom-right of
         every card that swallows the clicks, drags and marquee starts meant for
         the card. Measured on the deployed build: `elementFromPoint` at the
         row's centre returned the row, not the card, on 17 of 17 cards.

         Every variant here is the SAME spelling as its `opacity` twin on
         purpose. Tailwind orders candidates by VARIANT, and a variant's sort
         position is a property of the variant rather than of the utility, so
         identical variants make the two properties resolve on identical
         conditions BY CONSTRUCTION: `pointer-events: auto` holds exactly when
         `opacity: 1` holds. A hand-written CSS rule, a bare `@media` block or
         an inline style would put the cascade back in play and break that.

         Why each channel, and why none of them can deadlock:
         - `group-hover` / `group-focus-within` key off the CARD (`group
           relative`, BaseNode.tsx), never off this row, and the row's box is a
           strict subset of the card's. So a pointer over the at-rest row falls
           through to the card, the card becomes `:hover`, and the row flips to
           `auto` in the same frame. Had the trigger been a bare `hover:` on the
           row, this fix would be impossible.
         - `[@media(pointer:coarse)]` is MANDATORY, not symmetry for its own
           sake. A touch device has no hover, so `group-hover` never fires
           there; omitting it would leave four permanently visible and
           permanently untappable controls — a worse defect than the one this
           closes, and invisible to both jsdom and the (fine-pointer) browser
           gate.
         - Keyboard is unaffected either way: `pointer-events` gates hit-testing
           of pointer input only. It touches neither the tab order, nor the
           accessibility tree, nor Enter/Space activation, nor `.click()`.

         ⚠ REBASED ONTO #1274's COUNTER-SCALED GEOMETRY. The class list below is
         STAGING's — `CANVAS_CORNER_INSET_CLASSES` / `CANVAS_GAP_CLASSES`, which
         landed after this fix was written — with the `pointer-events` mirror
         added to it. BOTH changes are kept; neither side was taken wholesale.
         The `opacity` variants are byte-identical to the ones this fix was
         originally written against, so the 1:1 mirror argument above still
         holds exactly. */
      className={`node-quick-actions flex ${CANVAS_GAP_CLASSES[6]} transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto [@media(pointer:coarse)]:pointer-events-auto motion-reduce:transition-none ${alwaysVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      data-testid={`node-quick-actions-${nodeId}`}
    >
      {/* ⭐ THE EDIT ROUTE (row 20) — FIRST, as the contract's rail draws it
          (edit leftmost, coaching rightmost), and inside this hover group so it
          inherits the group's reveal and its opacity/pointer-events mirror
          rather than carrying a second spelling of them. More stays last. */}
      {hasEditRoute && (
        <Tooltip asChild delay={300} content="Edit">
          <button
            type="button"
            onClick={handleEdit}
            onPointerDown={stopPointer}
            className={BUTTON_CLASSES}
            aria-label={`Edit ${label}`}
            data-testid={`node-action-edit-${nodeId}`}
          >
            {/* `Pencil` — the glyph the option card's edit route already uses. */}
            <Pencil size={NODE_RAIL_GLYPH_PX} aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
          </button>
        </Tooltip>
      )}
      {canAsk && coachingChip === null && (
        <Tooltip asChild delay={300} content="Ask Olumi">
          <button
            type="button"
            onClick={handleAsk}
            onPointerDown={stopPointer}
            className={BUTTON_CLASSES}
            aria-label={`Ask Olumi about ${label}`}
            data-testid={`node-action-ask-${nodeId}`}
          >
            {/* `MessageCircle` — the ONE "Ask Olumi" glyph (Panel R3, #63
                5796609717), the same glyph as the rail's coaching icon. */}
            <MessageCircle size={NODE_RAIL_GLYPH_PX} aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
          </button>
        </Tooltip>
      )}
      {/* ⭐ THE GENERATIVE PEER OF THE ASK. Second, not last: it sits beside
          "Ask Olumi about this" because the two are the same kind of act — a
          question to the model about THIS element — and the overflow keeps its
          deliberate final position. Identical geometry to its siblings, so the
          cluster stays one row of equal 20px controls.

          `Zap` is the icon the context menu already uses for "Challenge this"
          (`useMenuItems.ts`), so the button and the menu entry it unburies read
          as the same action rather than as two features. */}
      {canChallenge && (
        <Tooltip asChild delay={300} content={challengeHint}>
          <button
            type="button"
            onClick={handleChallenge}
            onPointerDown={stopPointer}
            className={BUTTON_CLASSES}
            aria-label={`Challenge ${label}`}
            data-testid={`node-action-challenge-${nodeId}`}
          >
            <Zap size={NODE_RAIL_GLYPH_PX} aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
          </button>
        </Tooltip>
      )}
      {/* ⭐ THE DOOR TO EVERYTHING ELSE THIS NODE CAN DO.
          Deliberately LAST: the two named shortcuts above are the ruling's
          "powerful science-grounded shortcuts", and this is the overflow, not a
          third peer. It adds no new capability and makes no claim about the
          model — it re-emits the gesture that already opens this node's menu,
          for the input classes that cannot perform it.

          ⚠ THE PARAGRAPH THAT CLOSED THIS BLOCK IS NO LONGER TRUE AND IS
          QUOTED RATHER THAN DELETED. It read: *"The tooltip names right-click on
          purpose. A user who learns the gesture from it stops needing the
          button, which is the right direction for an affordance whose job is
          discoverability."* The reasoning was sound and the sentence it
          described is gone — the tooltip is now "More actions" (see
          TOOLTIP COPY above). Teaching the gesture is still worth doing; a
          hover hint that has to stay short is not where it fits, and the next
          reader should not inherit a comment describing copy the file no longer
          contains. */}
      <Tooltip asChild delay={300} content="More actions">
        <button
          type="button"
          onClick={handleOpenMenu}
          onPointerDown={stopPointer}
          /* ⭐ 20px VISUAL, 24px TARGET — and as of this change ALL of them, not
             just this one. `h-5 w-5` keeps the visual identical to its siblings;
             `before:-inset-[2px]` expands the hit area to 24×24, WCAG 2.2 AA
             2.5.8's minimum. The comment here used to end "the siblings share the
             shortfall and are left alone" — a correctly-scoped decision then, and
             the rowed work this change closes. See the wrapper's `gap-1.5` for
             why the gap had to move with it. */
          className={BUTTON_CLASSES}
          aria-label={`More actions for ${label}`}
          /* Announces that a menu follows. `aria-haspopup` is used by five other
             canvas components, so its absence here was a real gap rather than a
             repo convention. ⛔ NO `aria-expanded`: this button dispatches an
             event and does not own the menu's open state, so it could not keep
             that attribute truthful — and a stale `aria-expanded` is worse than
             none. */
          aria-haspopup="menu"
          data-testid={`node-action-menu-${nodeId}`}
        >
          <MoreHorizontal size={NODE_RAIL_GLYPH_PX} aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
        </button>
      </Tooltip>
    </div>
    {(restingIcons || coachingChip !== null) && (
      <div
        className={`flex items-center ${CANVAS_GAP_CLASSES[6]} pointer-events-auto`}
        data-testid={`node-card-rail-resting-${nodeId}`}
      >
        {restingIcons}
        <NodeCoachingIcon nodeId={nodeId} chips={coaching} />
      </div>
    )}
    </div>
  )
})
