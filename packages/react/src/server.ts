/**
 * @cuestack/react — **server entry**, selected by the `react-server` export
 * condition.
 *
 * Same surface as the client entry, different implementation. Kept separate
 * from day one: a malformed condition order does not throw, it silently
 * resolves the client bundle into a server context, and the symptom surfaces
 * two waves later as a hydration bug nobody can trace.
 */

export type { EntryKind } from './index.js'

export const ENTRY_KIND = 'server' as const

export const REACT_WAVE = 0 as const
