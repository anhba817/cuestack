/**
 * The stylesheet, adopted into the shadow root.
 *
 * Every value resolves from a `--cs-*` custom property or a `var(--cs-theme-*, …)` fallback — the
 * same names the React player's stylesheet consumes, so a host that themed one has themed both.
 * Custom properties inherit across a shadow boundary, which is what makes the isolation affordable.
 *
 * **The reduced-motion block is the second half of a two-part mechanism.** The frame layer emits both
 * an ordinary and a mirrored `--cs-r-*` value; this chooses between them at paint time. It has to be
 * CSS rather than script: the preference cannot be read on a server, so a script would defer the
 * choice and a learner who asked for less motion would see the full motion first.
 *
 * The nesting is the mechanism, not a flourish. Where the kernel emitted a reduced value it wins;
 * where it did not, the element falls back to no motion rather than to full motion.
 */
export const STYLESHEET = `
:host {
  display: block;
  position: relative;
  overflow: hidden;
  background: var(--cs-theme-surface-default, transparent);
  color: var(--cs-theme-text-default, inherit);
  font-family: var(--cs-theme-font-body, system-ui, sans-serif);
}

.cs-stage {
  /*
   * A container, so every authored coordinate can be expressed as a proportion of the canvas
   * rather than as a physical pixel. This is NX-2's logical-canvas scaling, and matching it is
   * what makes the two adapters lay a lesson out the same way.
   *
   * The first draft used width/height 100% with elements positioned in raw pixels, which rendered
   * a 1600-unit canvas at 1600 physical pixels whatever the container was: the same lesson twice
   * the size of the React player's on an 800px page, overflowing rather than scaling. Invisible to
   * the agreement suite, which compares the custom properties *feeding* these rules — both adapters
   * wrote --cs-x: 0 and disagreed entirely about what that meant.
   */
  container-type: size;
  container-name: cs-stage;
  aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h);
  width: 100%;
  max-width: 100%;
  position: relative;
  /* Off-canvas content is clipped to the stage rather than extending the host's page. */
  overflow: hidden;
  /* A stage with no background borrows the host's, which makes authored contrast unpredictable. */
  background: var(--cs-theme-surface-default, transparent);
}

.cs-element {
  position: absolute;
  box-sizing: border-box;

  /* Proportions of the canvas, not pixels — see the stage rule above. */
  left: calc(var(--cs-x) / var(--cs-canvas-w) * 100cqw);
  top: calc(var(--cs-y) / var(--cs-canvas-h) * 100cqh);
  width: calc(var(--cs-w) / var(--cs-canvas-w) * 100cqw);
  height: calc(var(--cs-h) / var(--cs-canvas-h) * 100cqh);

  z-index: var(--cs-z, 0);
  opacity: var(--cs-opacity, 1);

  /*
   * --cs-rotation is the *authored* rotation and --cs-rotate is what an effect contributes.
   * Two names because they are two things, and the first draft of this adapter wrote neither the
   * property nor this line, so an authored rotation rendered flat.
   *
   * Translation is canvas-relative like everything else: an effect that moves an element 40 units
   * must move it 40 units of the same canvas, or motion and position disagree about their unit.
   */
  transform:
    translate(
      calc(var(--cs-tx, 0) / var(--cs-canvas-w) * 100cqw),
      calc(var(--cs-ty, 0) / var(--cs-canvas-h) * 100cqh)
    )
    scale(var(--cs-sx, 1), var(--cs-sy, 1))
    rotate(calc((var(--cs-rotation, 0) + var(--cs-rotate, 0)) * 1deg));
  /*
   * Order matters — transforms do not commute, so scale-then-rotate and rotate-then-scale place a
   * rotated, non-uniformly-scaled element differently. This is the player's order, character for
   * character, and the draft above it had the two swapped.
   */
  transform-origin: center center;

  /*
   * Filters. highlight and dim are two of the eight builtin effects and neither moves anything —
   * they change brightness — so an adapter with no filter declaration renders both as nothing at
   * all. No error, no missing element: a learner simply never sees the thing the author drew
   * attention to.
   *
   * blur is in the contribution contract but no builtin produces one; a third-party effect can.
   */
  /*
   * Brightness is a multiplier and stays one. Blur is a *length*, in the same logical units as
   * everything else, so it scales with the stage like any other size — a blur fixed at 8px softens
   * an edge on a desktop and obliterates the same element on a phone. Now that the stage is a
   * container this can follow the player exactly; the previous raw-pixel form is gone with the rest
   * of the fixed-size layout.
   */
  filter:
    brightness(var(--cs-brightness, 1))
    blur(calc(var(--cs-blur, 0) / var(--cs-canvas-w) * 100cqw));
}

.cs-element img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.cs-unavailable {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1px dashed var(--cs-theme-border-muted, currentColor);
  color: var(--cs-theme-text-muted, inherit);
  font-size: var(--cs-theme-font-size-caption, 0.8125rem);
  text-align: center;
}

.cs-problem {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  padding: 0.5rem;
  background: var(--cs-theme-surface-muted, transparent);
  color: var(--cs-theme-text-default, inherit);
  font-size: var(--cs-theme-font-size-caption, 0.8125rem);
}

/*
 * Slide transitions, matching the React player's transition.css in both hooks and behaviour.
 *
 * Declarative rather than a re-render per frame: the duration arrives as --cs-transition-ms and the
 * type as an attribute, so the browser animates and the frame loop keeps writing only element
 * styles. That is the same decision Stage.tsx records, and it is what keeps a slide change inside
 * the frame budget.
 */
.cs-transition {
  display: grid;
  width: 100%;
}

.cs-transition > .cs-stage {
  grid-area: 1 / 1;
}

/* The leaving slide sits beneath, so the arriving one is what a learner reads. */
.cs-transition > [data-cs-transition='leaving'] {
  z-index: 0;
}

.cs-transition > [data-cs-transition='entering'] {
  z-index: 1;
}

@keyframes cs-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cs-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes cs-slide-in {
  from { opacity: 0; transform: translateX(4%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes cs-slide-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-4%); }
}

@keyframes cs-zoom-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes cs-zoom-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(1.04); }
}

[data-cs-transition='entering'][data-cs-transition-type='fade'] {
  animation: cs-fade-in calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}
[data-cs-transition='leaving'][data-cs-transition-type='fade'] {
  animation: cs-fade-out calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}

[data-cs-transition='entering'][data-cs-transition-type='slide'] {
  animation: cs-slide-in calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}
[data-cs-transition='leaving'][data-cs-transition-type='slide'] {
  animation: cs-slide-out calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}

[data-cs-transition='entering'][data-cs-transition-type='zoom'] {
  animation: cs-zoom-in calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}
[data-cs-transition='leaving'][data-cs-transition-type='zoom'] {
  animation: cs-zoom-out calc(var(--cs-transition-ms, 0) * 1ms) ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  /*
   * **Replaced, not shortened** — BR-015, and the same rule the React player follows. A learner who
   * asked for no motion did not ask for briefer motion, so slide and zoom become a fade. Fade is
   * already the reduced form of itself and is left alone: cross-fading is not movement.
   */
  [data-cs-transition='entering'][data-cs-transition-type='slide'],
  [data-cs-transition='entering'][data-cs-transition-type='zoom'] {
    animation-name: cs-fade-in;
  }
  [data-cs-transition='leaving'][data-cs-transition-type='slide'],
  [data-cs-transition='leaving'][data-cs-transition-type='zoom'] {
    animation-name: cs-fade-out;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cs-element {
    --cs-opacity: var(--cs-r-opacity, var(--cs-opacity, 1));
    --cs-tx: var(--cs-r-tx, 0);
    --cs-ty: var(--cs-r-ty, 0);
    --cs-sx: var(--cs-r-sx, 1);
    --cs-sy: var(--cs-r-sy, 1);
    --cs-rotate: var(--cs-r-rotate, 0);
    --cs-brightness: var(--cs-r-brightness, var(--cs-brightness, 1));
    --cs-blur: var(--cs-r-blur, var(--cs-blur, 0));
  }
}
`
