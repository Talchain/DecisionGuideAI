/** Types for the census spec's import of the rule's own lists (`no-raw-chance-read.js`). */
import type { Rule } from 'eslint'

export declare const CHANCE_FIELDS: readonly string[]
export declare const CHANCE_GATE_CATEGORIES: Readonly<Record<string, string>>
declare const rule: Rule.RuleModule
export default rule
