// The shape of words.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
/** A chance as the percentage a person reads: exactly as stated (0.4% is "0.4%"), "0%" only for an exact zero. */
export function percent(x: number): string
/** The complete change set a held proposal makes (records and top-level fields), the one place what is approved is read from. */
export function changeSetOf(view: any): { added: string[]; changed: string[]; removed: string[]; top: string[] }
export function changeRows(view: any): Array<{ id: string; action: string; label: string; author: string; [k: string]: unknown }>
