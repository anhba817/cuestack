# Contract: the stage stylesheet

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

The stylesheet is not decoration — it is the scaling mechanism. This contract exists because
someone will eventually try to replace it with JavaScript, and should be able to see why not.

## The mechanism

```css
.cs-stage {
  container-type: size;
  aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h);
  width: 100%;
  overflow: hidden;              /* FR-011: off-canvas content is clipped, not expanding */
}

.cs-element {
  position: absolute;
  left:   calc(var(--cs-x) / var(--cs-canvas-w) * 100cqw);
  top:    calc(var(--cs-y) / var(--cs-canvas-h) * 100cqh);
  width:  calc(var(--cs-w) / var(--cs-canvas-w) * 100cqw);
  height: calc(var(--cs-h) / var(--cs-canvas-h) * 100cqh);
  opacity: var(--cs-opacity, 1);
  transform:
    translate(calc(var(--cs-tx, 0) / var(--cs-canvas-w) * 100cqw),
              calc(var(--cs-ty, 0) / var(--cs-canvas-h) * 100cqh))
    scale(var(--cs-sx, 1), var(--cs-sy, 1))
    rotate(calc((var(--cs-rotation, 0) + var(--cs-rotate, 0)) * 1deg));
}
```

## Why container query units

Because the server has no viewport. A computed `transform: scale(k)` needs a measured width, so
the server would emit a guessed layout and the browser would correct it on first paint — which is
both the layout shift SC-004 forbids and a defeat of FR-001, since the markup that arrived would
be wrong.

Container query units resolve against the container during layout. The same stylesheet produces
correct geometry on the server and in the browser, with no measurement and no script. Font size
scales too, which percentages cannot do — percentage font size resolves against the parent's font
size, not the container's width.

**A computed scale factor is refused, not overlooked.** It is the obvious solution and it is the
one thing that cannot work here.

## Why every value is a custom property

Three consequences, all load-bearing:

1. The frame loop writes properties on a ref, so playback costs no React reconciliation.
2. Reduced motion becomes a stylesheet concern — a later wave neutralises `--cs-tx` inside
   `@media (prefers-reduced-motion: reduce)`, needing no script and therefore working on a
   server-rendered first frame. **This is the mechanism that makes NFR-ACC-004 reachable.** A
   renderer writing `transform` directly would make the preference unhonourable without
   JavaScript.
3. Server and client set identical properties from identical input, so hydration matches by
   construction.

## Required fallbacks

Every consumed property carries a fallback: `var(--cs-opacity, 1)`, `var(--cs-sx, 1)`,
`var(--cs-tx, 0)`. An element with no effects therefore needs no properties written at all, and a
missing property degrades to the identity rather than to `invalid`. Without the fallback, one
absent custom property invalidates the whole `transform` declaration and the element jumps to the
origin — a failure mode that looks like a positioning bug and is not one.

## Theme tokens

Theme values arrive as `--cs-theme-*` on the stage and are consumed by renderers via
`var(--cs-theme-colour-text, <readable default>)`. The fallback is FR-019: a lesson whose theme
omits a token must render readably rather than invisibly.

**No element renderer may contain a colour, font, or spacing literal.** Enforced by lint, not
review, because a hard-coded `#333` is invisible in a diff and fatal to theming.

## Scoping

Every selector is prefixed `cs-` and every rule is scoped beneath `.cs-stage`. The stylesheet
contains no element selectors, no `*`, and no `:root` rules. A host's typography and resets are
untouched (FR-026).
