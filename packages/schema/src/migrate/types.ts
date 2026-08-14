export interface MigrationStep {
  from: string
  to: string
  /** Receives a structural clone; must return a new value, never mutate. */
  up(manifest: unknown): unknown
}
