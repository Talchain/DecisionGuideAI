/**
 * DetailToggleContext — React context carrying the "Show full detail" toggle state.
 * Provided by ModelTabHeader, consumed by all section components.
 */

import { createContext } from 'react'
import type { DetailContext } from './types'

export const DetailToggleContext = createContext<DetailContext>({ showDetail: false })
