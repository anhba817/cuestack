import { act } from 'react'
import { render } from '@testing-library/react'
import type { LessonManifest } from '@cuestack/schema'
import type { EffectRegistry, Ports } from '@cuestack/core'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { Timeline } from '../../src/timeline/Timeline.js'
import { Inspector } from '../../src/inspector/Inspector.js'
import { SequenceView } from '../../src/sequence/SequenceView.js'
import { useEditorSession, type EditorMode, type EditorSession } from '../../src/session/useEditorSession.js'
import { usePlayback, type Playback } from '../../src/session/usePlayback.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { countingIds } from './ids.js'

const DEFAULT_EDITORS = createElementEditorRegistry(builtinElementEditors)

/**
 * Render the editor the way a host does: the hooks live *inside* the tree.
 *
 * `renderHook` plus `render(<EditorCanvas session={result.current} />)` looks equivalent and is
 * not. It passes one snapshot of the session as a prop, so a later state change updates
 * `result.current` and leaves the rendered canvas holding the old object — every subsequent
 * keystroke is then handled against a stale selection and a stale draft.
 *
 * That produced a confusing failure: nudging "did nothing" because the overlay's handler read
 * an empty selection that the test had already changed. Rendering the hook inside the
 * component is both the fix and what a real host actually writes.
 *
 * The session is exposed through a mutable holder rather than a prop callback so assertions
 * can read the latest value without another render.
 *
 * **Playback is opt-in and mounted here for the same reason** (feature 006 T020). It is not
 * enough to call `usePlayback` outside and pass the result down: the writer registers element
 * nodes through a ref on mount, and the canvas has to render the *frame's* state while
 * playing rather than re-deriving it from a `session.authoringTime` that is stale by
 * contract. Both only work from inside the tree.
 */
export interface EditorHandle {
  readonly session: EditorSession
  /** Present only when `playback: true`. */
  readonly playback: Playback
}

export interface RenderEditorOptions {
  readonly mode?: EditorMode
  /** Mount `usePlayback` and thread its writer and frame state into the canvas. */
  readonly playback?: boolean
  /** Render the timeline below the canvas. Implies `playback`. */
  readonly timeline?: boolean
  /**
   * Render the inspector beside the canvas.
   *
   * Inside the tree, for the reason this whole file exists: a panel rendered in a *separate*
   * `render()` never re-renders when the session changes, so an effect added mid-test would
   * not appear and the test would assert against the element it captured at setup.
   */
  readonly inspector?: boolean
  /** A host's effect registry. One instance reaches the menu *and* `resolve` (FR-026). */
  readonly effects?: EffectRegistry
  /** Render Simple Sequence. The same timing data as the timeline, never a second copy. */
  readonly sequence?: boolean
  /**
   * A hand-advanced clock. Constitution II forbids a timing test that waits, and the
   * transport takes its time source as a port precisely so it never has to.
   */
  readonly ports?: Pick<Ports, 'time' | 'visibility'>
}

export function renderEditor(
  manifest: LessonManifest,
  options: RenderEditorOptions = {},
): { handle: EditorHandle; container: HTMLElement; unmount: () => void } {
  const holder = { session: undefined as unknown as EditorSession, playback: undefined as unknown as Playback }
  const idSource = countingIds()
  const withPlayback = options.playback === true || options.timeline === true

  function Harness(): React.ReactNode {
    const session = useEditorSession({
      manifest,
      slideId: manifest.slides[0]!.id,
      idSource,
      ...(options.mode ? { mode: options.mode } : {}),
    })
    holder.session = session
    const slide = session.draft.slides.find((s) => s.id === session.slideId) ?? session.draft.slides[0]!
    return (
      <>
        {withPlayback ? <WithPlayback session={session} /> : <EditorCanvas session={session} />}
        {options.sequence ? <SequenceView session={session} /> : null}
        {options.inspector ? (
          <Inspector
            session={session}
            slide={slide}
            editors={DEFAULT_EDITORS}
            {...(options.effects ? { effects: options.effects } : {})}
          />
        ) : null}
      </>
    )
  }

  function WithPlayback({ session }: { session: EditorSession }): React.ReactNode {
    const playback = usePlayback(session, options.ports ? { ports: options.ports } : {})
    holder.playback = playback
    return (
      <>
        <EditorCanvas
          session={session}
          writer={playback.writer}
          {...(playback.frameState ? { state: playback.frameState } : {})}
          atMs={playback.atMs}
        />
        {options.timeline ? <Timeline session={session} playback={playback} /> : null}
      </>
    )
  }

  const { container, unmount } = render(<Harness />)
  return { handle: holder as EditorHandle, container, unmount }
}

/**
 * Advance the *lesson* clock, then let real animation frames fire.
 *
 * The same shape as `@cuestack/react`'s `runFrames`, and deliberately so: the kernel clamps
 * a single tick to `CLAMP_CEILING_MS` (250 ms), so advancing 2 500 ms in one step yields
 * 250 ms of lesson time — machine sleep and a paused debugger produce the same enormous
 * delta and none of them happened to the learner. Crossing a slide therefore means many
 * small steps, which is what a real frame loop does anyway.
 *
 * Nothing waits on wall-clock time. What is real here is only the *scheduling*: happy-dom
 * implements `requestAnimationFrame` on a timer, and the frame loop is the one thing that
 * runs as time passes.
 */
export async function runFrames(
  ports: { advance(ms: number): void },
  ms: number,
  stepMs = 100,
): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.advance(Math.min(stepMs, ms - elapsed))
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
  }
}

/** One frame, with no lesson time passing. For settling a render rather than moving time. */
export async function frame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

/**
 * A `TimeSource` a test drives by hand, plus a visibility port it can flip.
 *
 * The same shape the kernel's timing suites have used since Wave 1. Nothing here waits: a
 * test that contained `await sleep(...)` would be asserting against the machine's load
 * rather than against the transport (Constitution II).
 */
export function fakePorts(): Pick<Ports, 'time' | 'visibility'> & {
  advance(ms: number): void
  setHidden(hidden: boolean): void
} {
  let now = 0
  let hidden = false
  const listeners = new Set<(hidden: boolean) => void>()
  return {
    time: () => now,
    visibility: {
      isHidden: () => hidden,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    advance: (ms) => {
      now += ms
    },
    setHidden: (next) => {
      hidden = next
      for (const listener of listeners) listener(next)
    },
  }
}
