# Contract: element renderers

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

What an element renderer supplies, and — more importantly — what it is not given.

## The contract

```tsx
interface ElementRenderer {
  readonly type: string
  readonly Component: (props: { element: ResolvedElement }) => ReactNode
  /** How assistive technology describes this type when the author gave no label. */
  readonly label: string
}
```

## What a renderer receives

Exactly one thing: the `ResolvedElement` the kernel produced. Not the slide, not the lesson, not
the transport, not the current time, not its siblings.

The restriction is the same one the kernel's plugin contract makes, for the same reason: a
renderer *able* to reach the lesson becomes one that does, and then the lesson shape cannot change
without breaking third-party renderers.

## What a renderer must not do

**Position itself.** The wrapper applies `left`, `top`, `width`, `height`, `opacity`, and
`transform` from custom properties. A renderer that positioned its own content would become a
second place geometry is decided, and the two would eventually disagree.

**Read the clock, or animate.** All timing is in `ResolvedElement`. A renderer with its own
transition would be a second timing implementation — exactly what Principle V forbids, and the
divergence would be invisible until an editor preview and a player showed different things.

**Write a colour, font, or spacing literal.** Everything resolves from `--cs-theme-*` with a
readable fallback. Enforced by lint, because a hard-coded `#333` survives review and then survives
every theme.

**Touch the DOM imperatively.** The frame loop is the only imperative writer, and it lives in one
place so it can be audited.

## What a renderer must do

**Be reachable and announced.** Any interactive element carries an accessible name, role, and
state, and is reachable by keyboard (FR-017). A `<div onClick>` is not acceptable where a
`<button>` will do.

**Reserve its space.** An image or video declares its intrinsic dimensions from the manifest's
asset reference before the bytes arrive (FR-015). This is why the manifest carries `width` and
`height` on an asset reference at all — so a slide can hold the right shape while loading.

**Degrade visibly.** An asset that fails to load leaves its reserved space and an accessible
description rather than collapsing the layout (FR-018).

## The built-in seven

| Type | Renders | Accessibility obligation |
|---|---|---|
| `text` | Themed text | Inherits the document language |
| `image` | `<img>` with reserved dimensions | `alt` from the author; empty `alt` if decorative |
| `shape` | Inline SVG | `aria-hidden` — a rectangle has nothing to announce |
| `video` | `<video>` with native controls | Caption track when authored |
| `audio` | `<audio>` with native controls | Transcript link when authored |
| `button` | `<button>` | Label as accessible name |
| `question` | Prompt and options as a radio group | Grouped and labelled; **inert until Wave 3** |

**On the inert question.** It renders, is reachable, and is announced, but answering does nothing
until Wave 3. It is marked `aria-disabled` rather than silently unresponsive, because a control
that looks operable and is not is worse for a learner using a screen reader than one that says so.

## Registration

Registered, never switched on — the same `no-switch-on-element-type` rule that guards the kernel
extends here. An unregistered optional type renders a placeholder that reserves space and
announces itself as unavailable, matching the kernel's `available: false`. An unregistered
required interaction blocks, matching the kernel's `blocked`.
