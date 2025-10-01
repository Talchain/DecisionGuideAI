import { isGhostEnabled } from '../flags'

export type Severity = 'BLOCKER' | 'IMPROVEMENT' | 'OBSERVATION'

export interface CritiqueItem { id?: string; text: string }
export interface CritiqueGroup { severity: Severity; items: CritiqueItem[] }
export interface Draft { id: string; critiques: CritiqueGroup[] }
export interface GhostPanelProps { drafts?: Draft[] }

const ORDER: Severity[] = ['BLOCKER', 'IMPROVEMENT', 'OBSERVATION']

function mergeItems(groups: CritiqueGroup[], sev: Severity): CritiqueItem[] {
  const out: CritiqueItem[] = []
  for (const g of groups) if (g.severity === sev) out.push(...(g.items || []))
  return out
}

export default function GhostPanel({ drafts }: GhostPanelProps) {
  if (!isGhostEnabled()) return null
  const list = drafts || []
  if (!list.length) return <section data-testid="ghost-panel">No drafts yet</section>
  return (
    <section data-testid="ghost-panel" aria-label="Ghost Critique Panel">
      {list.map((d, idx) => (
        <article key={d.id || idx} data-testid="ghost-card" style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          {ORDER.map((sev) => {
            const items = mergeItems(d.critiques || [], sev)
            if (!items.length) return null
            return (
              <section key={sev} data-testid={`severity-${sev}`} style={{ marginTop: 8 }}>
                <h3 style={{ margin: '8px 0 4px' }}>{sev}</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {items.map((it, i) => (
                    <li key={it.id || i}>
                      {it.text}
                      {sev === 'BLOCKER' ? (
                        <span style={{ marginLeft: 8, display: 'inline-flex', gap: 6 }}>
                          <button disabled>Accept</button>
                          <button disabled>Edit</button>
                          <button disabled>Dismiss</button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </article>
      ))}
    </section>
  )
}
