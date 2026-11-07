/**
 * WHEN THE MODEL TAB MAY CHANGE THE MODEL, AND IN WHICH WORDS (Paul 7 Nov: "make it so much easier and slicker for users to actually
 * manually edit the model through this interface"). One gate for every direct edit the tab offers, the same gate the canvas's own editors
 * keep (`FigureEdit.tsx`, `Rename.tsx`, `AddFigure.tsx`, `LinkRemove.tsx`): the person's own page (`isForThisPage`), the latest version
 * (`at` null), and an approved board core will take an edit on (`model.edit_base` set; core sets it null while a proposal is held). Each
 * editor keeps the base it opened on, so a newer version never takes the person's words silently: core refuses in its own words.
 *
 * The write keys are the canvas editors' own, so a figure being saved from the tab reads as being saved on its card too, and the same
 * request is never sent twice from two places (`runWrite`).
 */
import type { View } from '../client'
import { isReading, useViewStore } from '../store'
import { isForThisPage, useMe } from '../../olumiCore/me'
import { useModelTab, type EditTarget } from './state'

export type ModelEdit = {
  readonly sid: string | null
  /** The version core takes a direct edit on; null while a proposal is held, on an earlier version, or off the person's own page. */
  readonly base: number | null
  /** Olumi's change waiting for the person: direct edits open once it is approved or set aside. */
  readonly held: { readonly id: number; readonly heading: string; readonly on: string } | null
}

function modelEditOf(sid: string | null, view: View | null, at: number | null, me: Parameters<typeof isForThisPage>[1]): ModelEdit {
  if (sid === null || view === null || at !== null || !isForThisPage(view, me)) return { sid, base: null, held: null }
  const p = view.proposal
  const held = p !== null && p.base !== null && (view.model?.edit_base ?? null) === null ? { id: p.id, heading: p.heading, on: p.on } : null
  return { sid, base: view.model?.edit_base ?? null, held }
}

export function useModelEdit(): ModelEdit {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  return modelEditOf(sid, view, at, me)
}

/** The same gate, as it stands at a press (outside a render). */
export function modelEditNow(): ModelEdit {
  const { sid, view, at } = useViewStore.getState()
  return modelEditOf(sid, view, at, useMe.getState().me)
}

/**
 * Open an editor on what the person pressed, on the scenario and version they see at that press (base-at-open: a later version never
 * takes their words silently; core refuses in its own words). `typed` is what the field starts with (a card's name for a rename).
 */
export function openEditor(target: EditTarget, typed = ''): void {
  const { sid, base } = modelEditNow()
  if (sid === null || base === null) return
  useModelTab.getState().edit({ ...target, sid, base, typed })
}

/** How long a save waits for a newer read to settle what it shows, before saying it could not be shown. */
const READ_WAIT_MS = 20000

/**
 * The View read after a write, told apart from a read a newer one overtook. `read` answers false for both (store.ts `refresh`, whose own
 * rule is that the newest read settles what is on screen); a newer read began after the write landed, so its answer is this one's:
 * - `shown`: the read landed, or a newer one did and `shows` says the View now holds the write (for a save: no longer stale);
 * - `failed`: every read since has failed (or none settled in READ_WAIT_MS);
 * - `moved`: the page left the scenario meanwhile, so nothing is said here about it.
 */
export async function readAfter(sid: string, read: () => Promise<boolean>, shows: () => boolean): Promise<'shown' | 'failed' | 'moved'> {
  if (useViewStore.getState().sid !== sid) return 'moved'
  const landed = await read()
  const verdict = () => (useViewStore.getState().sid !== sid ? 'moved' as const : landed || shows() ? 'shown' as const : 'failed' as const)
  if (landed || !isReading()) return verdict()
  const t0 = Date.now()
  return new Promise((resolve) => {
    const tick = setInterval(() => {
      if (isReading() && useViewStore.getState().sid === sid && Date.now() - t0 < READ_WAIT_MS) return
      clearInterval(tick)
      resolve(verdict())
    }, 50)
  })
}

/** After a save: the View read it starts (`modelChanged`), settled as `readAfter` says; shown once a read since the save has landed. */
export const readAfterSave = (sid: string) => readAfter(sid, () => useViewStore.getState().modelChanged(), () => !useViewStore.getState().stale)

/** The canvas editors' write keys (`FigureEdit`, `Rename`, `AddFigure`, `LinkRemove`), so one write is one write wherever it is pressed. */
export const editKey = {
  figure: (sid: string | null, id: string) => `${sid}:edit:${id}`,
  rename: (sid: string | null, id: string) => `${sid}:rename:${id}`,
  addFigure: (sid: string | null) => `${sid}:add-figure`,
  removeLink: (sid: string | null, remove: { readonly record: string; readonly part?: string | null }) =>
    `${sid}:remove-link:${remove.part == null ? remove.record : `${remove.record}.${remove.part}`}`,
} as const

/**
 * The tab's own words: UI chrome, never a model value or sentence. Where the canvas already says it, the canvas's words are kept
 * (FigureEdit: "Change figure", "Set figure", "Try without saving"; Rename; Add a figure; Remove link), so one action has one name.
 */
export const MODEL_EDIT_WORDS = {
  changeFigure: 'Change figure', setFigure: 'Set figure', tryIt: 'Try without saving', cancel: 'Cancel',
  rename: 'Rename', saveName: 'Save name', newName: 'New name',
  showOnCanvas: 'Show on canvas',
  addFigure: 'Add a figure', name: 'Name', figure: 'Figure', unit: 'Unit (optional)', add: 'Add', figureHint: 'One number, or a range like 150 to 400',
  removeLink: 'Remove link', removeAsk: 'Remove this link?', remove: 'Remove', keep: 'Keep',
  links: 'Links', restsOn: 'Rests on', whose: 'Whose', about: 'About', whatWouldChange: 'What would change it',
  saving: 'Saving…', changeTarget: 'Change target', changeLimit: 'Change limit', changeStrength: 'Change strength',
  heldLead: 'Olumi’s pending change is waiting for you.',
  heldBody: 'Approve it in the chat, or set it aside to change the model yourself. Setting it aside applies nothing in it.',
  heldAside: 'Set it aside', heldConfirm: 'Set aside', heldKeep: 'Keep it',
  heldFailed: 'That did not go through. Nothing was set aside.',
  settingAside: 'Setting it aside…',
  plain: 'Plain', expert: 'Expert', detail: 'Detail', to: 'to', from: 'from',
  askChange: 'Ask Olumi to change this', askChangeDraft: 'Please change',
  askOption: 'Ask Olumi for another option', askOptionDraft: 'Suggest another option we have not considered.',
  askRisk: 'Ask Olumi what risks are missing', askRiskDraft: 'Which risks are missing from this model?',
  askLink: 'Ask Olumi about missing links', askLinkDraft: 'Which links between these factors are missing or wrong?',
  failed: 'That did not go through. Nothing was saved.',
  // An editor whose offer core withdrew while it was open (edit_base null): Save is off, and this says why; the typing stays.
  withdrawnHeld: 'This cannot be saved while Olumi’s pending change waits. Your typing is kept.',
  withdrawnPast: 'Go back to the latest version to save this. Your typing is kept.',
  withdrawn: 'This cannot be saved here just now. Your typing is kept.',
  savedNotShown: 'Saved, but Olumi could not show it just now. Reload the page to see it.',
  triedFailed: 'That did not go through. Nothing was tried.',
} as const
