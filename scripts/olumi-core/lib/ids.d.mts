// The shape of ids.mjs for the specs that import it from TypeScript (the .mjs itself stays plain JavaScript, outside the gate).
/** The UUID form of a core scenario id (reversible, no lookup); null when it is not one. */
export function derivedUuidOfSid(sid: string): string | null
