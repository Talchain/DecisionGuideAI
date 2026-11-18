/**
 * The type roles the Analysis and Reasoning tabs use, from the panel's one scale (`typography.viewPanel*`): 12 metadata, 12 reading, 18 the
 * sparing headline. No size of this module's own (the earlier raw fallbacks are gone now the tokens exist).
 */
import { typography } from '../../styles/typography'

export const TYPE = {
  /** 12/16: marks, second lines, tab words. */
  meta: typography.viewPanelMeta,
  /** 12/18: every reading line. */
  body: typography.viewPanelBody,
  /** 18/500: the panel's one headline. */
  headline: typography.viewPanelHeadline,
} as const
