/**
 * A filename goes into the brief the user sends as their own words, so it is
 * reduced to plain, single-line text: no path, no control or bidi-override
 * characters, no brackets that could pass for a locator marker.
 */
const MAX_NAME = 80

export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[[\]<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const capped = cleaned.length > MAX_NAME ? `${cleaned.slice(0, MAX_NAME - 1)}…` : cleaned
  return capped || 'your file'
}
