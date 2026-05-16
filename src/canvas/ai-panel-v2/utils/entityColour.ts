// Maps an entity kind to a Tailwind border-colour class for the
// selection tint on the AI zone top edge / pull-tab. Brief §6.1.
//
// Edge selection falls back to the default panel border (no tint) per the
// brief: edges don't carry a discrete entity-colour token in DS v5.

export type EntityKind = 'goal' | 'factor' | 'option' | 'risk' | 'outcome' | 'edge' | 'unknown'

export function borderColourClassFor(kind: EntityKind): string {
  switch (kind) {
    case 'goal': return 'border-goal'
    case 'factor': return 'border-factor'
    case 'option': return 'border-option'
    case 'risk': return 'border-danger'
    case 'outcome': return 'border-success'
    case 'edge':
    case 'unknown':
    default:
      return 'border-panel-border'
  }
}

// Best-effort mapping from a canvas node `type` to the entity kind used
// by the brief's colour map. Canvas uses some legacy synonyms; map them
// here so the rest of the panel doesn't have to care.
export function nodeKindFromType(type: string | undefined): EntityKind {
  switch (type) {
    case 'goal':
    case 'decision':
      return 'goal'
    case 'factor':
    case 'variable':
      return 'factor'
    case 'option':
    case 'intervention':
      return 'option'
    case 'risk':
    case 'failure':
      return 'risk'
    case 'outcome':
    case 'result':
      return 'outcome'
    default:
      return 'unknown'
  }
}
