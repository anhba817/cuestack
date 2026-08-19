/**
 * When to save, how long to wait before trying again, and when a save is a checkpoint.
 *
 * A pure module so the four checkpoint triggers and the backoff are a table in a
 * `studio-pure` test rather than four branches inside a hook that needs a DOM to exercise.
 * Nothing here reads a clock: every duration is a number the caller measures with the
 * injected `Scheduler`.
 */

/** NFR-PERF-005: autosave begins approximately 1.5 seconds after the last eligible edit. */
export const IDLE_MS = 1500

/**
 * Five attempts spanning roughly two minutes, backing off between each.
 *
 * Long enough to ride out a router reboot or a backend restart with the teacher none the
 * wiser; short enough that the editor never claims to be trying long after it stopped. An
 * editor that retries forever is one whose status nobody reads (FR-022).
 */
export const BACKOFF_MS: readonly number[] = [1_000, 4_000, 15_000, 45_000, 60_000]
export const MAX_ATTEMPTS = BACKOFF_MS.length

/** FR-035a: a checkpoint at most once every quarter hour of *continued editing*. */
export const CHECKPOINT_INTERVAL_MS = 15 * 60 * 1000

/** How long to wait before attempt number `attempt` (1-based). Null once they are spent. */
export function backoffFor(attempt: number): number | null {
  return BACKOFF_MS[attempt - 1] ?? null
}

export interface CheckpointInput {
  /** Has any checkpoint been recorded for this lesson in this session? */
  readonly anyRecorded: boolean
  /** Editing time accumulated since the last checkpoint — not elapsed time. */
  readonly editingMsSinceCheckpoint: number
  /** The teacher asked for one, by name or otherwise. */
  readonly requested: boolean
  /** A restore is about to replace unsaved work (FR-042). */
  readonly beforeRestore: boolean
}

/**
 * Whether this save should be recorded in the version history.
 *
 * The four triggers of FR-035a, in one place. The interval counts **continued editing**
 * rather than wall-clock time, which is why the caller accumulates it only while changes are
 * arriving: a lesson left open overnight must record nothing.
 */
export function isCheckpoint(input: CheckpointInput): boolean {
  if (input.requested || input.beforeRestore) return true
  if (!input.anyRecorded) return true
  return input.editingMsSinceCheckpoint >= CHECKPOINT_INTERVAL_MS
}
