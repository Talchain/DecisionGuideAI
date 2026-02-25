/**
 * Shared brief read-only page — stub for C.1a.
 *
 * Full implementation (fetch by slug, read-only graph + analysis view) is C.1b Task 7.
 * Wiring point: scenarioService.getSharedBriefBySlug.
 * No authentication required — uses anon-accessible RPC.
 */

import { useParams } from 'react-router-dom'

export default function SharedBriefPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold text-text-header">Shared brief</h1>
      <p className="mt-4 text-text-body">Brief: {slug}</p>
      <p className="mt-2 text-text-light">
        Full read-only view coming in C.1b.
      </p>
    </div>
  )
}
