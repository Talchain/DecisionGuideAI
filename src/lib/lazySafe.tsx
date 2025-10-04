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
        <div className="p-3 border rounded-lg bg-gray-50">
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-600">Not available in this PoC preview build.</div>
        </div>
      )
    }))
  )
