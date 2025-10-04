// src/lib/lazySafe.tsx
// POC: Safe lazy loader that doesn't crash on missing modules

import * as React from 'react'

export const lazySafe = (
  loader: () => Promise<any>,
  title: string
) =>
  React.lazy(() =>
    loader().catch(() => ({
      default: () => (
        <div style={{
          padding: '12px',
          border: '1px dashed #d1d5db',
          borderRadius: '8px',
          background: '#f9fafb',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Not available in this PoC preview build.
          </div>
        </div>
      )
    }))
  )
