'use client'

import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { createAdvanceController, type Ports, type Transport } from '@cuestack/core'
import { LessonPlayer, type AssetResolver } from '@cuestack/react'
import type { EditorSession } from '../session/useEditorSession.js'
import { usePreviewSession } from './usePreviewSession.js'
import { PreviewControls } from './PreviewControls.js'
import { ViewportPreset } from './ViewportPreset.js'
import { PREVIEW_PRESETS } from './constants.js'
import type { PreviewStart } from './startPoint.js'

export type { PreviewStart } from './startPoint.js'

export interface PreviewProps {
  readonly session: EditorSession
  /** Where to begin. The three entry points of US2 (FR-008, FR-009, FR-010). */
  readonly from: PreviewStart
  readonly onClose: () => void
  /** The editor's own resolver, inherited rather than reinvented (FR-003). */
  readonly resolveAsset?: AssetResolver
  /**
   * Substitutable timing, so a test can hand-advance the clock (Constitution II).
   *
   * Merged into the player's own ports **per member**, which is why a test may pass a whole
   * object and production passes almost nothing.
   */
  readonly ports?: Partial<Ports>
}

/**
 * The lesson, as a learner receives it, inside the editor.
 *
 * **It mounts the player. It does not build one.** No renderer, no clock, no effect
 * implementation, no completion state of its own — Constitution V is not a thing this
 * component is careful about, it is a thing it has no opportunity to violate, because
 * everything a learner sees is rendered by `@cuestack/react` from the same `resolve`.
 *
 * ## The chrome is split, and the player's own render is why
 *
 * `LessonPlayerClient` renders `children` inside a ternary — completion state, else gesture
 * prompt, else children. So anything passed as `children` **disappears when the lesson
 * completes and while a gesture prompt is showing**.
 *
 * The line is therefore *what must survive that ternary*, not *what needs the transport*:
 * this component holds the transport in a ref regardless, because the start-point seek needs
 * one. Inside, as `children`, go the controls that are only meaningful while the lesson is
 * playing — play, pause, seek, previous, next. Outside, in this frame, goes everything that
 * must stay reachable at the completion state and behind a gesture prompt: close, restart,
 * the override switch, its indicator, the viewport preset.
 *
 * Restart is the control that makes the distinction matter. It needs the transport *and* it
 * is required at the completion state, so a rule about transport access would have put it in
 * the half that disappears.
 *
 * ## Two things that do not happen by themselves
 *
 * **Opening stops the editor's own clock.** A preview opened mid-playback would run two
 * clocks and two frame loops over one slide, and the authoring time the editor promises to
 * restore would move while the teacher watched. The host pauses before mounting this.
 *
 * **The editor behind is unreachable, not merely covered.** Tab does not respect z-index,
 * and every key handler in the studio is element-scoped, so focus is the whole path into an
 * edit: one Tab out and one arrow key nudges an element, invisibly, since this holds the
 * draft as it stood at open. A modal `<dialog>` hands the top layer, the inertness, the
 * focus containment, and Escape to the platform.
 */
export function Preview({ session, from, onClose, resolveAsset, ports }: PreviewProps): ReactNode {
  const preview = usePreviewSession(session, from)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const transportRef = useRef<Transport | null>(null)
  const openerRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  const indicatorId = useId()

  /**
   * The ports the player is built from: the host's own, plus one member this replaces.
   *
   * **A partial, deliberately.** The player builds its DOM media port over a frame writer it
   * owns and exposes to nobody, so replacing the whole object would leave the preview silent
   * and stall every slide gated on media. Passing one member keeps everything else.
   *
   * The member is `analytics`, and the override is why it matters most: the player records
   * `lesson_started` on mount and a `slide_completed` for every slide it passes, so a preview
   * left wired to the host's telemetry would report a teacher's checking as a learner's
   * progress — and every gate the override skips as a completion nobody earned (FR-031).
   *
   * **It comes last, so nothing can opt out of it.** Every other member takes the caller's
   * value; this one does not, because FR-031 is a MUST NOT rather than a default. A test
   * observing the discard therefore hands in a recorder and asserts it stays empty, with the
   * player mounted directly as the control that proves the recorder works at all.
   */
  const previewPorts = useMemo<Partial<Ports>>(
    () => ({ ...ports, analytics: { record: () => undefined } }),
    [ports],
  )

  /**
   * Seek to the captured start point, once the player hands back its transport.
   *
   * **Memoised, and idempotent.** The player's mount effect lists `onReady` and `ports` among
   * its dependencies, so an inline arrow — the natural way to write this — gives a new
   * identity on every render and tears the effect down and back up: a fresh transport, a
   * fresh controller, a cleared writer, and playback restarted. The preview would appear to
   * stutter, and it would read as a timing bug rather than a dependency one.
   */
  const onReady = useCallback(
    (transport: Transport) => {
      transportRef.current = transport
      if (preview.startPoint.atMs > 0) transport.seek(preview.startPoint.atMs)
    },
    [preview.startPoint.atMs],
  )

  /**
   * Modality, focus, and the return target — all of it the platform's, none of it ours.
   *
   * The opener is captured during the *first render*, not in this effect: `autoFocus` on the
   * close button fires before effects run, so an effect reading `document.activeElement`
   * would find the preview's own control and close would return focus to a node that no
   * longer exists. Feature 005's delete confirmation has the same line and the same comment.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  /**
   * **The completion state is not rendered here, deliberately.**
   *
   * `LessonPlayerClient` renders the lesson's completion component itself when the lesson
   * finishes, so a second one would double it — and a preview holding its own idea of
   * "finished" is the
   * forked path Constitution V forbids. What this component owes at that moment is that the
   * frame above stays reachable, which the split makes true by construction: `children` is
   * replaced, and the frame is not `children`.
   *
   * The completion screen's own Review differs from the frame's Restart, and the difference
   * is intended. Review calls `goToSlide(0)` and plays — the *lesson's* beginning, which is
   * the lesson's own affordance behaving as a learner's would, and is what a preview is for.
   * Restart returns to the *preview's* start, in a fresh run. Two buttons doing different
   * things is only confusing if neither says which.
   */

  /**
   * Restart: a fresh run, not a seek.
   *
   * Bumping the generation re-keys the player, so the interaction state, the advance
   * controller, and the transport are all discarded and `onReady` seeks the new transport to
   * the same captured moment. A seek alone would return to the right position in a lesson
   * whose gates were all already satisfied.
   */
  const restart = preview.restart

  /**
   * Whether this lesson can be finished at all — a query, and only a query.
   *
   * The preview builds its own controller because the player constructs one internally and
   * its context exposes only the transport and the slide's duration. That is safe for
   * `reachability`, which is a pure inspection of a slide and the media port with no memory
   * of what has been decided. It must never be wired to `evaluate`, which keys decisions by
   * instance id and would decide slides the player's own controller had already decided.
   */
  const unreachable = useMemo(() => {
    const controller = createAdvanceController({ media: previewPorts.media } as Ports)
    for (const slide of session.draft.slides) {
      const problem = controller.reachability(slide)
      if (problem) return { slideId: slide.id, problem }
    }
    return null
  }, [session.draft, previewPorts])

  const title = session.draft.lesson.title

  return (
    <dialog
      ref={dialogRef}
      className="cs-preview"
      aria-label={`Preview: ${title}`}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="cs-preview-frame">
        <div className="cs-preview-chrome">
          <button type="button" data-cs-preview-close onClick={onClose} autoFocus>
            Close preview
          </button>
          <button type="button" data-cs-preview-restart onClick={restart}>
            Restart
          </button>
          <label className="cs-preview-override">
            <input
              type="checkbox"
              data-cs-preview-override
              checked={preview.override}
              aria-describedby={preview.override ? indicatorId : undefined}
              onChange={(e) => preview.setOverride(e.currentTarget.checked)}
            />
            Ignore every gate
          </label>
          <ViewportPreset value={preview.preset} onChange={preview.setPreset} />
        </div>

        {/*
          Continuous, not once. A teacher who set this several slides ago and forgot it would
          conclude the lesson works when what worked was the switch — and the longer a state
          lasts, the more that matters. `role="status"` announces the change; the text stays
          for as long as the state does (FR-019).
        */}
        {preview.override ? (
          <p className="cs-preview-indicator" id={indicatorId} role="status" data-cs-override-on>
            Gates are being ignored. This is not what a learner would experience.
          </p>
        ) : null}

        {unreachable ? (
          <p className="cs-preview-problem" role="status" data-cs-preview-unreachable>
            {`This lesson cannot be finished: ${unreachable.problem.message}`}
          </p>
        ) : null}

        <div
          className="cs-preview-viewport"
          data-cs-preview-preset={preview.preset}
          style={{ width: `${PREVIEW_PRESETS[preview.preset]}px`, maxWidth: '100%' }}
        >
          <LessonPlayer
            key={preview.generation}
            lesson={session.draft}
            slideIndex={preview.startPoint.slideIndex}
            ports={previewPorts}
            autoPlay
            onReady={onReady}
            overrideAdvance={preview.override}
            {...(resolveAsset ? { resolveAsset } : {})}
          >
            <PreviewControls slideCount={session.draft.slides.length} />
          </LessonPlayer>
        </div>
      </div>
    </dialog>
  )
}
