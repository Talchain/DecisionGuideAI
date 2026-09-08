import type { PathOrFileDescriptor } from 'node:fs'

type BackendSlot = 'staging' | 'manual-test'
type BuildEnvironment = Record<string, string | undefined>

export function selectBackendSlot(env: BuildEnvironment): BackendSlot
export function generateBackendSlot(env: BuildEnvironment, destination?: PathOrFileDescriptor): BackendSlot
