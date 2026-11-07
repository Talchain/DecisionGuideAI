/**
 * The three type roles the ported analysis components use (R25 scale A, by role: 12 metadata, 14 reading, 18 the one headline). The UI
 * session adds them as `typography.viewPanelMeta` / `viewPanelBody` / `viewPanelHeadline` on poc/r25-ui; until that lands, each falls back to
 * the same size here, so the swap at merge changes no rendered size. The shared panelMeta/panelBody tokens are not used: they return to
 * their legacy values for the legacy readers.
 */
import { typography } from '../../styles/typography'

type Roles = { viewPanelMeta?: string; viewPanelBody?: string; viewPanelHeadline?: string }
const t: Roles = typography as unknown as Roles

export const TYPE = {
  /** 12px: marks, second lines, tab words. */
  meta: t.viewPanelMeta ?? 'text-[12px] font-sans leading-snug',
  /** 14px: every reading line. */
  body: t.viewPanelBody ?? 'text-[14px] font-sans leading-relaxed',
  /** 18px semibold: the panel's one headline. */
  headline: t.viewPanelHeadline ?? 'text-[18px] font-semibold font-sans leading-snug',
} as const
