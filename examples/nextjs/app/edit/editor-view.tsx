'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ConflictNotice,
  EditorCanvas,
  Inspector,
  Preview,
  PortabilityControls,
  PublicationRecord,
  PublishControls,
  SaveStatus,
  Timeline,
  ValidationReport,
  VersionHistory,
  VersionList,
  builtinElementEditors,
  createElementEditorRegistry,
  useDraftPersistence,
  useEditorSession,
  useHistoryShortcuts,
  usePlayback,
  usePublishing,
  useValidation,
  type PreviewStart,
} from '@cuestack/studio'
import { browserScheduler, browserConnectivity, browserPorts } from '@cuestack/react'
import {
  createMemoryAssets,
  createMemoryPublishing,
  createMemoryStorage,
  importLesson,
  readPackage,
  type LessonPackage,
  type PublishedVersion,
  type RecordEntry,
} from '@cuestack/core'
import type { LessonManifest } from '@cuestack/schema'

const editors = createElementEditorRegistry(builtinElementEditors)

/**
 * The editor, mounted the way a host mounts it.
 *
 * `'use client'`, and there is no server variant — authoring is not server-rendered. The
 * player's page next door is the opposite: it renders its first slide on the server. Having
 * both in one example app is what makes the difference visible rather than asserted.
 *
 * **Saving is wired to the in-memory reference adapter** (feature 008). A host decides where a
 * lesson lives; this one puts it in a `Map`, which is enough to exercise every path — the idle
 * interval, the four status words, a conflict, and the version history all work here with no
 * backend at all, which is what FR-048 asks for.
 *
 * Three primitives come from `@cuestack/react` rather than being built here, and the reason is
 * a lint rule with no exemptions: `no-clock-in-studio` forbids the editor from constructing a
 * scheduler, so `browserScheduler` and `browserConnectivity` ship from the adapter package
 * beside `browserPorts` — the same route `usePlayback` already takes for its clock.
 *
 * **Three things have to be threaded for playback to work**, and a route that mounts the
 * timeline without them gets a playhead moving over a still canvas. The writer, because
 * element nodes register through a ref on mount; the frame's resolved state, because the
 * canvas otherwise re-derives from an authoring time that is stale while playing; and the
 * moment, so ghosts are labelled against what is on screen rather than against the session.
 */
export function EditorView({ lesson }: { lesson: LessonManifest }) {
  const [saved, setSaved] = useState(0)
  /**
   * One storage, one scheduler, one network signal — built once.
   *
   * Inline objects would be new on every render, and the save loop's effects depend on their
   * identity: a fresh scheduler each render would cancel and re-arm the interval forever and
   * nothing would ever save.
   */
  const storage = useMemo(() => {
    const memory = createMemoryStorage({ now: () => Date.now() })
    memory.seed('demo-lesson', lesson)
    return memory
  }, [lesson])
  /**
   * Publishing, over the in-memory reference (feature 009).
   *
   * The same argument as storage above, and FR-037 asks for it explicitly: validation, the publish
   * gate, immutability, withdrawal, and the record all work here with no backend at all. A host
   * swaps this one object for its own and changes nothing else on this page.
   */
  const publishingAdapter = useMemo(() => createMemoryPublishing({ now: () => Date.now() }), [])
  const assets = useMemo(() => createMemoryAssets(), [])
  const scheduler = useMemo(() => browserScheduler(), [])
  const connectivity = useMemo(() => browserConnectivity(), [])
  const visibility = useMemo(() => browserPorts().visibility, [])
  /**
   * The preview, and the two things a host has to do around it.
   *
   * `null` when closed rather than a boolean beside a start point, so the two cannot
   * disagree — a preview is always open *from* somewhere. And opening pauses playback first:
   * the editor's own clock does not stop by itself, and two clocks over one slide would move
   * the authoring time the preview promises to leave alone.
   */
  const [previewFrom, setPreviewFrom] = useState<PreviewStart | null>(null)
  const session = useEditorSession({
    manifest: lesson,
    slideId: lesson.slides[0]!.id,
    onChange: () => setSaved((n) => n + 1),
  })

  const persistence = useDraftPersistence({
    storage,
    lessonId: 'demo-lesson',
    openedAt: 'v1',
    draft: session.draft,
    scheduler,
    connectivity,
    // The author identity is what scopes locally kept work. A real host supplies whoever is
    // signed in; this demo supplies none, which selects the in-memory keeper — so nothing is
    // written to the browser and nothing could be offered to the next person at it.
    ports: { visibility },
  })

  /**
   * Undo and redo, bound at the editor's root.
   *
   * The host attaches this because `@cuestack/studio` exports parts a host composes and has no
   * editor root of its own — and undo has to work with focus in the inspector or the timeline,
   * not only on the canvas.
   */
  const root = useRef<HTMLDivElement>(null)
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  useEffect(() => setRootEl(root.current), [])
  useHistoryShortcuts(session, rootEl)

  const validation = useValidation({
    draft: session.draft,
    goToSlide: session.goToSlide,
    select: session.select,
  })

  const publishing = usePublishing({
    publishing: publishingAdapter,
    lessonId: 'demo-lesson',
    draft: session.draft,
    by: 'demo-teacher',
    saveNow: persistence.saveNow,
    assets,
  })

  /**
   * The published versions and the record, refreshed after anything that could change them.
   *
   * Held here rather than inside the hook because they are the host's to fetch: `usePublishing`
   * runs the ordered flow and does not poll, so a host that never shows a version list never pays
   * for one.
   */
  const [versions, setVersions] = useState<readonly PublishedVersion[]>([])
  const [entries, setEntries] = useState<readonly RecordEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const refreshPublished = useMemo(
    () => async () => {
      setVersions(await publishingAdapter.listPublished('demo-lesson'))
      setEntries(await publishingAdapter.readRecord('demo-lesson'))
      const active = await publishingAdapter.loadPublished('demo-lesson')
      setActiveId(active.ok ? active.version.id : null)
      setPublishedManifest(active.ok ? active.version.manifest : null)
    },
    [publishingAdapter],
  )
  useEffect(() => void refreshPublished(), [refreshPublished, publishing.outcome])

  /**
   * The published manifest, held so it can be exported as well as listed.
   *
   * FR-004d wants both kinds reachable, and this page already loads the active version for the
   * "Live now" marker — so offering the second export costs one piece of state rather than a
   * feature. Without it `kind: 'published'` would be a value nothing here can produce.
   */
  const [publishedManifest, setPublishedManifest] = useState<LessonManifest | null>(null)

  /**
   * Where a package goes — the host's, deliberately.
   *
   * `@cuestack/studio` has no filesystem and should not grow one, so the download link lives here.
   * This is the whole of research R-09's split: the studio hands over a value, the host decides what
   * a file is. The other end — where an imported package comes from — arrives with import.
   */
  const download = (pkg: LessonPackage): void => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${pkg.lesson.lesson.id}.${pkg.kind}.cuestack.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Where an imported package comes from — the host's, for the same reason the download is.
   *
   * A file input is a browser API, and `packages/studio/src` may not reach for one any more than it
   * may read a clock. The studio asks; this page answers.
   */
  const pickPackage = (): Promise<string | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json,.json'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        void file.text().then(resolve)
      }
      input.click()
    })

  /**
   * Import replaces the lesson that is open, through `replace-draft`.
   *
   * Two things follow from routing it that way rather than saving the result directly. The autosave
   * loop sees an ordinary edit to the lesson it already owns — so there is still exactly one route
   * by which a lesson reaches storage — and the import becomes **undoable**, because `apply` records
   * a history step for every successful edit. Replacing somebody's work is destructive, and this
   * framework answers that with undo rather than with a confirmation (FR-015c).
   *
   * The identity passed to `importLesson` is the **open** lesson's. The package's own is discarded:
   * honouring it would let a package from a stranger land on an unrelated lesson (FR-015a).
   */
  const acceptPackage = (text: string): string => {
    const read = readPackage(text)
    if (!read.ok) return read.message

    const imported = importLesson(read.package, { lessonId: session.draft.lesson.id })
    if (!imported.ok) return imported.message

    session.apply({ kind: 'replace-draft', manifest: imported.lesson })

    const migrated = imported.migrated.length > 0 ? ' It was brought forward from an older format.' : ''
    const missing =
      imported.unresolvedAssets.length > 0
        ? ` ${imported.unresolvedAssets.length} file(s) it refers to are not in this system.`
        : ''
    return `Imported, replacing the lesson that was open — undo to get it back.${migrated}${missing}`
  }

  const playback = usePlayback(session)
  const slide = session.draft.slides.find((s) => s.id === session.slideId) ?? session.draft.slides[0]!

  return (
    <div ref={root}>
      <SaveStatus state={persistence.state} onRetry={persistence.retry} />
      {persistence.conflict ? (
        <ConflictNotice
          conflict={persistence.conflict}
          onKeepMine={persistence.keepMine}
          onTakeStored={() => void persistence.takeStored()}
        />
      ) : null}
      <p>
        <button type="button" disabled={!session.canUndo} onClick={session.undo}>
          Undo
        </button>
        <button type="button" disabled={!session.canRedo} onClick={session.redo}>
          Redo
        </button>
        <button type="button" onClick={() => persistence.checkpoint('A place to come back to')}>
          Mark a version
        </button>
        <button type="button" onClick={() => void persistence.loadVersions()}>
          Show earlier versions
        </button>
      </p>
      <VersionHistory
        versions={persistence.versions}
        unavailable={persistence.versionsUnavailable}
        onRestore={(token) => {
          void persistence.restoreVersion(token).then((result) => {
            if (result.ok) session.apply({ kind: 'replace-draft', manifest: result.manifest })
          })
        }}
      />
      <p>
        {saved === 0
          ? 'Nothing changed yet. Edits live in this page and are not saved anywhere.'
          : `${saved} edit${saved === 1 ? '' : 's'} applied — held in memory only.`}
      </p>
      <p>
        <button type="button" onClick={() => validation.run()}>
          Check this lesson
        </button>
      </p>
      <ValidationReport report={validation.report} onSelect={validation.jumpTo} />
      <PublishControls publishing={publishing} active={activeId !== null} />
      <PortabilityControls
        draft={session.draft}
        {...(publishedManifest ? { published: publishedManifest } : {})}
        onExported={download}
        requestPackage={pickPackage}
        onImport={acceptPackage}
      />
      <VersionList versions={versions} activeId={activeId} />
      <PublicationRecord entries={entries} />
      <EditorCanvas
        session={session}
        writer={playback.writer}
        {...(playback.frameState ? { state: playback.frameState } : {})}
        atMs={playback.atMs}
      />
      <Timeline session={session} playback={playback} />
      <p>
        {(['beginning', 'slide', 'position'] as const).map((from) => (
          <button
            key={from}
            type="button"
            onClick={() => {
              playback.pause()
              setPreviewFrom(from)
            }}
          >
            {`Preview from the ${from}`}
          </button>
        ))}
      </p>
      {previewFrom ? (
        <Preview session={session} from={previewFrom} onClose={() => setPreviewFrom(null)} />
      ) : null}
      <Inspector session={session} slide={slide} editors={editors} />
    </div>
  )
}
