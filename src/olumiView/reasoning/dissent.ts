import type { View } from '../client'

export const displayedDissent = (d: View['collab']['dissent'][number]) => (d.confirmed?.words ?? d.position) !== ''
