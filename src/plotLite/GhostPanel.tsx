import React from 'react'
import { ghost } from './state'

export function GhostPanel() {
  if (!ghost.drafts.length) return null
  return (
    <aside aria-label="PLoT-lite suggestions" className="ghost-panel">
      {ghost.drafts.map((d) => (
        <section key={d.id} className="ghost-card" aria-label={`Suggestion: ${d.title}`}>
          <h3>{d.title}</h3>
          <p>{d.why}</p>
          <p>Confidence: {Math.round(d.suggestion_confidence * 100)}%</p>
          {d.fork_suggested && d.fork_labels?.length ? (
            <p>Fork: {d.fork_labels.join(' / ')}</p>
          ) : null}
          <details>
            <summary>Critique</summary>
            <ul>
              {d.critique.map((c, i) => (
                <li key={i}>
                  <strong>{c.severity}:</strong> {c.note}
                  {c.fix_available ? ' (fix available)' : ''}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </aside>
  )
}
