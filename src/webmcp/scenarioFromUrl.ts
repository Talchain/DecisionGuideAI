/**
 * EXPERIMENT ONLY (#76) — open a saved scenario from the page URL, for the ChatGPT
 * Desktop witness (its built-in browser has no devtools to set localStorage).
 *
 * `?olumi_scenario=<uuid>` sets the app's OWN current-scenario key and reloads once,
 * i.e. the proven guest-hydration path. The id comes from the URL the human opened,
 * never from a model's tool arguments; CEE still verifies access on every read.
 */
import { getCurrentScenarioId, setCurrentScenarioId } from '../canvas/store/scenarios'

const PARAM = 'olumi_scenario'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns true when it has scheduled a reload. */
export function adoptScenarioFromUrl(loc: Location = window.location): boolean {
  const url = new URL(loc.href)
  const wanted = url.searchParams.get(PARAM)
  if (!wanted || !UUID.test(wanted)) return false
  url.searchParams.delete(PARAM)
  if (getCurrentScenarioId() === wanted) {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    return false
  }
  setCurrentScenarioId(wanted)
  loc.replace(url.toString())
  return true
}
