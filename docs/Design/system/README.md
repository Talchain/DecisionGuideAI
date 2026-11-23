The one design system for the Olumi app. Every value here was read from the code. Where an older document disagrees, this page wins, and the code wins over this page.

Olumi is a reasoning partner for a team making a decision. People build a model of their scenario on a board of cards and links, read what it says in the right-hand panel, and talk it through with Olumi. The design exists to keep that calm and legible: the board shows the model, and the panel coaches.

Read the pages in this order. **Status** says what is built and what is still to do. **Behaviour** holds the rules for anything that floats. **Editing** describes how people change the model. **Checks** lists what guards each rule. **Decisions** lists what was decided and by whom. **History** lists the documents this one replaces.

## Principles

1. **Olumi improves reasoning and accelerates committed action.** That is the guiding principle, verbatim from `AGENTS.md`. Olumi is a reasoning partner, never an answer engine, and the person's judgement stays authoritative.
2. **The person authors; Olumi proposes.** Anything Olumi adds stays visibly Olumi's, in Olumi blue, until the person keeps it.
3. **One meaning per channel.** Shape says what a thing is, colour says how it is doing or whose it is, and an icon says what you can do. No channel does another's job.
4. **One focal object and one next step.** A screen has one filled button. A reply is a lead sentence plus at most three bullets, with the rest folded.
5. **Visual first.** A figure is a bar, an unknown is an empty dashed track, a state is an icon, and whose it is shows as a mark.
6. **Motion explains.** Motion is used only to show a change, uses one motion per region, finishes within 900ms, and is instant under reduced motion.
7. **Slick, never cute.** Restraint beats decoration, and nothing adds words at rest.
8. **The older look keeps working.** Every lane change leaves the older look's values alone until someone has seen a picture of it.

## Words

- Write British English in sentence case. Use "and", never "&". Use no em dashes.
- Never write "recommend", "best", "winner", "you should" or "go with". A win share is never called a chance.
- Use the product's words: scenario, brief, model, what-if, reasoning partner. "Decision" means only the person's own act of choosing.
- Do not use engine words in the interface (samples, runs, median). Put units on numbers, and write "about" for an approximation.
- Lead with the answer. Put a count before a list. Write empty states with "yet": "No figures in your model yet".
- Use no emoji, and no unicode glyphs as icons (✎ ⓘ ✕ ✗).

## Colour

There is one theme, light. The code defines no dark theme.

- **Surfaces.** Put the board on `bg-canvas`. Put every surface that holds content on `bg-panel`: cards, panels, menus, sheets, tips, toolbars and dialogs. Use `bg-panel-hover` for every neutral hover and for a selected row.
- **Text.** Use `text-header` for headings and selected labels, `text-body` for running text, and `text-light` for meta, labels, counts and grey icons. `text-light` is the lightest legal text colour; `bg-canvas` is its binding ground at 4.65:1.
- **Olumi blue is Olumi's alone.** Use `info` only for Olumi's own voice: the answering words, Olumi's proposals and highlights, and Olumi's mark. Never use it for a hover, a focus ring, a selected state or an ordinary text link. Use `info-ink` when Olumi's words sit on a tint or on `bg-canvas`.
- **Green is the person's action.** The one filled button on a screen is `success` with `text-header` ink (7.5:1), through `controls.actColours`. Never draw a black or ink-filled button.
- **Kinds.** Kind colours fill the kind marker and colour the card frame: `goal`, `option`, `factor`, `danger` for risk, `success` for outcome, and `text-light` for a limit and for the question.
- **Signals.** `warning` and `danger` are for fills, borders and icons. As text, use `warning-ink`; `danger` is 2.8:1 and is never body text.
- **Borders.** Use `border-default` (Tailwind `border-panel-border`) for every hairline. Only `border-field` may mark an editable field or a dashed underline (3.7:1). Never use a coloured border for decoration.
- **Links on the board.** `edge-positive` raises, `edge-negative` lowers, and `edge-neutral` has no sign yet.
- **The mark** keeps its own three colours, `olumi-mark-orange`, `olumi-mark-blue` and `olumi-mark-green`. The orange also frames a challenged card.
- Never write a hex or `rgb()` literal in a component. Every colour in `brand.css` is a channel triple (`--info-rgb: 39 122 157`) so that Tailwind opacity modifiers such as `border-info/30` emit a rule.

## Type

Inter, from Google Fonts, in three sizes and two weights.

- **Sizes are 12, 14 and 18 only. Weights are 400 and 500 only.** Never use 11, 13 or 16, and never 600 or 700.
- In panels and sheets:
  - `viewPanelHeadline` (14/500/20) is the one lead sentence of a reply or a panel.
  - `panelHeader` (14/500) is a sheet's heading.
  - `viewPanelBody` (12/18) is running text.
  - `viewPanelHeading` (12/500) labels a group.
  - `viewPanelMeta` (12/16) is meta, tabs, tips and counts.
  - `viewPanelTabular` sets figures in rows.
- On a card face:
  - `viewTitle` (14/500) is the title, two lines at most.
  - `viewValue` (14/500) is the figure.
  - `viewHeadline` (18/500) is the one large number, an option's chance.
  - `viewLabel` (12) is small text and the words on links.
- Always use a `typography.*` token. Never a raw `text-xs`, `text-[13px]` or `font-semibold`.
- The older look's tokens (`panelMeta` 11, `chatBody` 13, `nodeTitle` 13, `nodeLabel` 11) stay for the older look only.

## Spacing

The lane standard. Every value is a Tailwind step on the 4px scale.

| Where | Value | Class |
|---|---|---|
| Inside a panel, sheet, form or tray | 12 | `p-3` |
| Summary line to the content below it | 12 | `space-y-3` |
| Between groups | 16 | `space-y-4` |
| Group label to its list | 8 | `space-y-2` |
| Between items that wrap to several lines | 12 | `space-y-3` |
| A single-line row | 10 above and below, 38 high | `py-2.5` |
| Dense underlined text (quoted words) | 24 line | `leading-6` |
| Inside a card face | 8 | `gap-2` |
| Inside a menu shell | 6 | `p-1.5` |
| Between cards on the board | 24 across, 48 between tiers | layout constants |

Use `gap` on flex and grid parents instead of margins on children.

## Shape, depth and layers

- **Radius.**
  - `radius-control` (6) for the lane's 28px chips and buttons.
  - `radius-sm` (8) for rows, tips and fields.
  - `radius-md` (12) for menus, cards, the composer and the review line.
  - `radius-lg` (14 in practice) for sheets, forms and dialogs.
  - `radius-pill` for the top-seam toolbars, pills and badges.
- **Shadow.**
  - `shadow-2` for everything that floats.
  - `shadow-1` for tips and resting pills.
  - `shadow-3` for modals only.
  - Cards on the lane draw no shadow.
- **Layers.**
  - Take z-index from `CANVAS_LAYER_CLASS` in `src/canvas/layers.ts`, never from a `z-[n]` literal.
  - Order, bottom to top: sheet 60, dock 900, chrome menus 1200, menus 5011, submenus 5012, tips 5013, modals 6000.

## States

| State | How it looks |
|---|---|
| Hover | `bg-panel-hover`, with ink moving up from `text-light` to `text-body`. Never blue. |
| Focus | A 2px ring in `text-header`, `focus-visible` only. Never blue. |
| Selected | `text-header`, weight 500, `bg-panel-hover`, plus a 1px `text-header` ring on tabs. A selected card has a 2px ring in `focus-color`. |
| Disabled | `text-light` at 50%. It stays focusable through `aria-disabled` and says why in its tip. |
| Proposed by Olumi | A `border-info` frame or an `info` halo. |
| Challenged | An `olumi-mark-orange` frame. |
| Doubt or assumption | Dashed: the card frame, the kind marker or the link (`5 4`). |

## Motion

- Use the four durations: `duration-instant` 100, `duration-fast` 200, `duration-base` 300 and `duration-slow` 400. The default easing is `ease-in-out`.
- Menus fade in over `duration-fast`. Tips wait 150ms. A card's hover preview waits 400ms and lets go after 100ms.
- While Olumi answers:
  - the words "Olumi is answering" show in `info`, with a light pass every 2.4s;
  - to their left, one 14px kind shape steps through the kinds on the board every 900ms;
  - seconds appear after 5s.
- Under reduced motion, every duration is 0.01ms, and the answering shape stays on the first kind.

## Iconography

- **One registry.** Draw every icon through `OkIcon`, `OkIconButton` or `LabelledIcon` from `src/olumiView/look/icons.tsx`, by its id. The registry holds 161 ids, which wrap lucide-react 0.344.0 at stroke 1.75. Never import `lucide-react` in a component.
- **14px and grey.** Draw icons in controls and rows at 14px in `text-light`, and let ink rise with the row's hover. The registry's default is still 16, so pass `size={14}`.
- **Every icon is a control or a mark.** An icon button names its action in a light Tip. An icon beside text is a labelled image.
- **The Olumi mark** is drawn by `OlumiAiIcon` from inline paths, with its ring in `currentColor` and three shapes in the mark colours. The standalone file is `public/olumi-mark.svg` (see Assets).
- **Kind markers** are the shapes in `NodeShapeIndicator`:
  - factor: circle;
  - option: square;
  - goal: diamond;
  - question: flat-top hexagon;
  - risk: downward triangle;
  - outcome: upward triangle;
  - limit: outlined square.
  An assumption's marker is dashed.

## Layout

- The board fills the window, and the right-hand dock is 22.5rem when open and 2.5rem when collapsed.
- Floating chrome sits on the board: the top bar, the lens bar, the left rail and the zoom rail.
- Never let a floating surface cover the chat or the composer.
- Check every screen at 2000 by 1205, at 1232 by 704, and at 1128 by 680 with 1.33 scale.
