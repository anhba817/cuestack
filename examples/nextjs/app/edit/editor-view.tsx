'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ConflictNotice,
  EditorCanvas,
  Inspector,
  Preview,
  SaveStatus,
  Timeline,
  VersionHistory,
  builtinElementEditors,
  createElementEditorRegistry,
  useDraftPersistence,
  useEditorSession,
  useHistoryShortcuts,
  usePlayback,
  type PreviewStart,
} from '@cuestack/studio'
import { browserScheduler, browserConnectivity, browserPorts } from '@cuestack/react'
import { createMemoryStorage } from '@cuestack/core'
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
