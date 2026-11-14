/**
 * Every saved View file the gallery can draw: the fixtures the specs already read. Each is loaded only when asked for, as its own chunk of
 * the gallery build; nothing here is reachable from the product build (its entry is index.html, which never loads the gallery).
 */
const found = import.meta.glob<unknown>([
  '../fixtures/**/*.json', '../golden/*.json', '../__tests__/fixtures/*.json',
  '../port/__tests__/fixtures/*.json', '../reasoning/__tests__/fixtures/*.json', '../model/fixtures/*.json',
], { import: 'default' })

/** By the file's path under src/olumiView (for example `fixtures/cardface/bakery.view3.json`). */
export const loaders: Readonly<Record<string, () => Promise<unknown>>> =
  Object.fromEntries(Object.entries(found).map(([path, load]) => [path.replace(/^\.\.\//, ''), load]))

export const VIEW_SCHEMA_ID = 'olumi.view/3'
export type SavedView = { readonly schema: string; readonly id: string; readonly you?: unknown; readonly you_id?: unknown }

/** A whole View document for one core scenario (`s_<12 hex>`): the only kind of file a frame can draw. */
export function isSavedView(doc: unknown): doc is SavedView {
  const d = doc as { schema?: unknown; id?: unknown } | null
  return d !== null && typeof d === 'object' && d.schema === VIEW_SCHEMA_ID && typeof d.id === 'string' && /^s_[0-9a-f]{12}$/.test(d.id)
}

/** The scenario's address on the real page (src/olumiCore/team/sid.ts `derivedUuidOf`, repeated here so no app module loads before the isolation). */
export const frameHashOf = (view: SavedView, key: string): string => `#/scenario/00000000-0000-4000-8000-${view.id.slice(2)}?gf=${encodeURIComponent(key)}`

/** The three sizes Paul reads at: wide, his usual window, and the layout of his 1.33 scale (2000x1200 at 133%; the scale itself is not reproduced). */
export const SIZES: readonly (readonly [number, number])[] = [[2000, 1200], [1232, 704], [1500, 904]]
