/**
 * THE VIEW GALLERY'S ONLY SCRIPT (view-gallery.html). With `?gf=<file>` in the hash it is ONE FRAME: the saved View is loaded, the
 * isolation is put in place (./isolate.ts), and only then is the app's own boot loaded (src/main.tsx), so the real scenario page draws the
 * saved View and everything it asks for goes through the isolation. With no `gf` it is the list of saved Views (./list.ts).
 * Order matters: no code of the app is imported above the isolation (its stylesheet is, see below).
 */
// The app's stylesheet, linked from this page as index.html links it. Loaded by a later import instead, it would be a preload that fails
// the whole boot whenever the font host it names is out of reach (first proof, 14 Nov: the frame stayed blank). A stylesheet runs no code;
// its font request is the one request no isolation of this kind can see, and the list page says so.
import '../../index.css'
import { answerOf, isolate } from './isolate'
import { frameHashOf, isSavedView, loaders } from './manifest'

const key = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('gf')
const root = document.getElementById('root')
const say = (words: string) => { if (root !== null) root.textContent = words }

async function start(): Promise<void> {
  if (key === null) { (await import('./list')).drawList(root); return }
  const load = loaders[key]
  if (load === undefined) { say(`No saved View is named ${key}.`); return }
  const view = await load()
  if (!isSavedView(view)) { say(`${key} is not a whole View document, so the page cannot draw it.`); return }
  // The frame is the saved View's own scenario page, whatever address it was opened at.
  const hash = frameHashOf(view, key)
  if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  isolate(window, key, answerOf(view))
  await import('../../main')
}
// A saved file or the app's own boot that will not load is said on the page, never left as a blank frame.
start().catch((e: unknown) => say(`This frame could not be loaded: ${e instanceof Error ? e.message : String(e)}`))
