import type { ReactNode } from 'react'
import { resolve, type RenderState } from '@cuestack/core'
import {
  Stage,
  SlideView,
  canvasFor,
  createRendererRegistry,
  staticRenderers,
  type ElementRendererRegistry,
  type ThemeValues,
} from '@cuestack/react'
import type { FrameWriter } from '@cuestack/react'
import type { LessonManifest, Slide } from '@cuestack/schema'
import { Overlay } from './Overlay.js'
import {
  createElementEditorRegistry,
  builtinElementEditors,
  type ElementEditorRegistry,
} from '../registry/editors.js'
import type { EditorSession } from '../session/useEditorSession.js'

export interface EditorCanvasProps {
  readonly session: EditorSession
  readonly theme?: ThemeValues
  /**
   * The renderers the canvas draws with. Defaults to the player's own set, which is the
   * point — a host swapping this must swap it for the player too, or the two diverge.
   */
  readonly renderers?: ElementRendererRegistry
  /** Which types can be added and which carry on-canvas text. Defaults to the seven MVP types. */
  readonly editors?: ElementEditorRegistry
  /**
   * The frame writer, when this canvas will ever play.
   *
   * Optional for the static and host cases only. Registration runs `SlideView` →
   * `ElementFrame` → `writer.refFor(element.id)`, on mount — so a canvas that will play must
   * be given one from its **first** render, or the writer's node map is empty and `write()`
   * iterates nothing (feature 006 T029).
   */
  readonly writer?: FrameWriter
  /**
   * The frame's resolved state, supplied by `usePlayback` while playing.
   *
   * Without it this component computes `resolve(slide, session.authoringTime)` at render
   * time — and R-02 leaves that time stale during playback, so the canvas would render the
   * play-start element set for the whole of playback while the playhead advanced over it.
   * That is Wave 2's defect, and it hid because every test drove a seek, which re-renders.
   */
  readonly state?: RenderState
  /** The moment the canvas is showing, for anything that must label it — ghosts, mainly. */
  readonly atMs?: number
}

/**
 * The player's **static** renderer set, wrapped once rather than per render.
 *
 * Static rather than interactive, and the distinction is not an optimisation. A teacher
 * composing a slide is authoring a question, not answering one: the interactive renderer
 * carries a submit control and a live region that need interaction state the editor has no
 * business holding, and offering them would invite a teacher to answer their own question on
 * the canvas. Trying it out is *preview*, which is ED-6.
 *
 * This is still one renderer in Constitution V's sense — both sets live in `@cuestack/react`
 * and the static one is what the player itself server-renders. It is chosen, not forked.
 *
 * Found by the overlay parity suite, which compared the editing canvas against
 * `LessonPlayerStatic` and reported the question markup differing by a submit button.
 */
const DEFAULT_RENDERERS = createRendererRegistry(staticRenderers)

const DEFAULT_EDITORS = createElementEditorRegistry(builtinElementEditors)

/**
 * The editing canvas: the player's own render, with an overlay beside it.
 *
 * Two layers over one `Stage`, and the split is Constitution V made structural.
 *
 * **The render layer is `@cuestack/react` used exactly as the player uses it.** Same
 * `Stage`, same `SlideView`, same renderer registry, same `resolve()`. It is handed no
 * editor prop and knows nothing about selection, handles, or modes. If it ever needs a
 * change to serve the editor, that change is a parity defect and the need belongs in the
 * overlay instead (contracts/overlay-contract.md, rule 2).
 *
 * **The kernel is untouched.** `resolve(slide, authoringTime)` is called with the same two
 * arguments the player passes. Wave 1 cut the seam this rests on before there was an editor
 * to use it: `ResolvedElement.geometry` is documented as *authored* position — "effects do
 * NOT mutate this" — so a drag handle attaches to geometry while an effect's displacement
 * stays in `transform`, and the two never contend (research R-01).
 *
 * Elements the resolver leaves out — hidden, or outside their time window — are drawn by the
 * overlay as ghosts, from the diff below. They are affordances rather than renders, which is
 * why the player cannot grow one: it has no overlay to draw them in (research R-02).
 */
export function EditorCanvas({
  session,
  theme,
  renderers = DEFAULT_RENDERERS,
  editors = DEFAULT_EDITORS,
  writer,
  state: frameState,
  atMs,
}: EditorCanvasProps): ReactNode {
  const slide = currentSlide(session.draft, session.slideId)
  // The frame's state while playing; our own when idle. Both come from the same `resolve`,
  // which is what keeps this a second consumer of one engine rather than a second engine.
  const state = frameState ?? resolve(slide, atMs ?? session.authoringTime)

  // Present in the draft, absent from the render. Computed here rather than stored: it is
  // derived session data and changes with the authoring time (data-model.md §7).
  const renderedIds = new Set(state.elements.map((e) => e.id))
  const absent = slide.elements.filter((e) => !renderedIds.has(e.id))

  // The logical canvas the manifest's coordinates are expressed against. A lesson property,
  // read from the aspect ratio — not a measurement of anything rendered.
  const { w, h } = canvasFor(session.draft.lesson.aspectRatio)

  return (
    <div className="cs-editor">
      <Stage lesson={session.draft} {...(theme ? { theme } : {})}>
        <SlideView state={state} renderers={renderers} {...(writer ? { writer } : {})} />
        <Overlay
          session={session}
          slide={slide}
          absent={absent}
          canvas={{ width: w, height: h }}
          editors={editors}
          atMs={atMs ?? session.authoringTime}
        />
      </Stage>
    </div>
  )
}

function currentSlide(draft: LessonManifest, slideId: string): Slide {
  const slide = draft.slides.find((s) => s.id === slideId) ?? draft.slides[0]
  /* v8 ignore next -- the schema requires at least one slide, so this cannot be reached
     for a valid manifest; the guard exists so a caller passing an unknown slideId gets a
     clear failure rather than a property access on undefined. */
  if (!slide) throw new Error('This lesson has no slides, which the schema does not permit.')
  return slide
}
