import { useState, type ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import { exportLesson, type LessonPackage } from '@cuestack/core'

/**
 * Two controls, deliberately thin.
 *
 * Features 008 and 009 shipped panels because saving and publishing have *states* that change over
 * time — Saving, Saved, Offline, a conflict standing open. Export and import have no state: they are
 * momentary actions with an outcome. A third panel here would be symmetry rather than need, and
 * would add a fifth and sixth status word to a vocabulary Constitution III fixes at four.
 *
 * **Nothing here reads or writes a file.** `packages/studio/src` may not touch the filesystem any
 * more than it may read a clock — where a package is written, what it is called, and where an
 * imported one comes from are the host's business. Export hands a value to a callback; import asks
 * the host for one. The example app supplies both ends with a download link and a file input, which
 * is where a browser API belongs (research R-09).
 */

export interface PortabilityControlsProps {
  /** The lesson as it stands. Exported as `kind: 'draft'`. */
  readonly draft: LessonManifest
  /**
   * The version learners currently receive, when the host has one and wants it exportable.
   *
   * Absent by default: a control offering a published export with nothing behind it would put this
   * project's declared-with-no-producer pattern into a button (FR-004d).
   */
  readonly published?: LessonManifest
  readonly onExported: (pkg: LessonPackage) => void
  /**
   * Where an imported package comes from. Supplied by the host because the studio has no file
   * browser and should not grow one. Absent means importing is not offered here.
   */
  readonly requestPackage?: () => Promise<string | null>
  readonly onImport?: (text: string) => Promise<string> | string
}

export function PortabilityControls({
  draft,
  published,
  onExported,
  requestPackage,
  onImport,
}: PortabilityControlsProps): ReactNode {
  const [said, setSaid] = useState<string | null>(null)

  const exportNow = (manifest: LessonManifest, kind: 'draft' | 'published'): void => {
    onExported(exportLesson(manifest, { kind }))
    setSaid(kind === 'draft' ? 'Exported this lesson.' : 'Exported the published version.')
  }

  const importNow = async (): Promise<void> => {
    if (!requestPackage || !onImport) return
    const text = await requestPackage()
    // A teacher who changed their mind is not an error, and saying nothing is the right answer.
    if (text === null) return
    setSaid(await onImport(text))
  }

  return (
    <div className="cs-portability" aria-label="Export and import">
      <button type="button" data-cs-export-draft onClick={() => exportNow(draft, 'draft')}>
        Export this lesson
      </button>

      {published ? (
        <button
          type="button"
          data-cs-export-published
          onClick={() => exportNow(published, 'published')}
        >
          Export the published version
        </button>
      ) : null}

      {requestPackage && onImport ? (
        <button type="button" data-cs-import onClick={() => void importNow()}>
          Import a lesson
        </button>
      ) : null}

      {/* The word is the state. Announced politely, because a teacher who pressed the button is
          probably looking at their slide rather than at this line (NFR-ACC-003). */}
      {said ? (
        <span className="cs-portability-status" role="status" aria-live="polite">
          {said}
        </span>
      ) : null}
    </div>
  )
}
