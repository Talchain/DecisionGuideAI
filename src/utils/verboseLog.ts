/**
 * verboseLog — gated debug logging helper.
 *
 * Only emits in development when the user has opted in:
 *   localStorage.setItem('debug.verbose', '1')
 *
 * Silent by default even in dev, so the console is clean for normal usage.
 * Never emits in production.
 *
 * Usage:
 *   import { verboseLog, verboseWarn } from '../../utils/verboseLog'
 *   verboseLog('[MyTag] some info', { data })
 *   verboseWarn('[MyTag] warning', value)
 */

/* eslint-disable no-console, no-restricted-syntax */

function isVerboseEnabled(): boolean {
  return import.meta.env.DEV && localStorage.getItem('debug.verbose') === '1'
}

export function verboseLog(message: string, ...args: unknown[]): void {
  if (!isVerboseEnabled()) return
  console.log(message, ...args)
}

export function verboseWarn(message: string, ...args: unknown[]): void {
  if (!isVerboseEnabled()) return
  console.warn(message, ...args)
}

export function verboseDebug(message: string, ...args: unknown[]): void {
  if (!isVerboseEnabled()) return
  console.debug(message, ...args)
}
