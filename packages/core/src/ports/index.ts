import type { AnalyticsAdapter, AssetAdapter, StorageAdapter } from '../adapters/index.js'
import type { MediaPort } from './media.js'
import type { VisibilityPort } from './visibility.js'

export type { MediaPort, MediaStatus } from './media.js'
export type { VisibilityPort } from './visibility.js'

/**
 * Monotonically non-decreasing milliseconds.
 *
 * The kernel does not verify monotonicity — checking every tick would cost more
 * than the bug is worth. A source that goes backwards is undefined behaviour.
 */
export type TimeSource = () => number

/**
 * The complete list of things the kernel cannot do itself.
 *
 * Grouped into one type deliberately: adding a port is then a visible change at
 * every construction site, rather than a quiet new obligation.
 */
export interface Ports {
  readonly time: TimeSource
  readonly media: MediaPort
  readonly visibility: VisibilityPort
  readonly storage: StorageAdapter
  readonly assets: AssetAdapter
  readonly analytics: AnalyticsAdapter
}
