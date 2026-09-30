/**
 * True on the routes that mount the canvas (`/canvas`, `/scenario/:id`), read
 * from the HashRouter location. Anything else — the scenario list, the panel
 * setup page, the dev sandbox — keeps the app-level shortcut.
 */
export function isCanvasRouteHash(hash: string): boolean {
  return /^#\/(canvas|scenario\/[^/?#]+)(?:[?#]|$)/.test(hash)
}
