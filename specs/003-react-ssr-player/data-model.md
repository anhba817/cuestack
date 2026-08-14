# Phase 1 Data Model: React SSR Player

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

Feature 001 described stored data; feature 002 described computed data. This one describes
**presented** data — the props a host supplies and the style properties that reach the page.
Nothing here is persisted and nothing is computed: every value is either given by the host or
read from the kernel's `RenderState`.

---

## The shape of the whole feature

```
LessonManifest ──resolve(slide, t)──> RenderState ──applyVisual──> CSS custom properties
   (feature 001)        (feature 002)                (this feature)
```

The third arrow is all this feature adds. It has no inverse and no state: the same
`RenderState` always produces the same properties. That is what keeps the parity guarantee true
now that it has two consumers instead of one.

---

## Entity: PlayerProps

What a host supplies. Deliberately small — a host that has to configure a dozen things will
configure them differently in two places.

| Prop | Type | Required | Notes |
|---|---|---|---|
| `lesson` | `LessonManifest` | **yes** | Already validated. The player is not a second validator. |
| `slideIndex` | number | no | Defaults to 0. Present so a host can deep-link. |
| `autoPlay` | boolean | no | Defaults false. Playback with audible media requires a gesture (BR-014), which Wave 3 enforces; defaulting to false is correct now and stays correct then. |
| `elements` | `ElementRendererRegistry` | no | Defaults to the built-in seven. |
| `theme` | `ThemeValues` | no | Merged over the lesson's own theme, letting a host brand a lesson it did not author. |
| `controls` | `'default' \| 'none'` | no | `none` for a host supplying its own. Not `boolean`, so a third option later is not a breaking change. |
| `onSlideChange` | `(index: number) => void` | no | |
| `onEvent` | `(event: LessonEvent) => void` | no | The analytics adapter's shape, so a host wires one thing rather than two. |

No `onTimeUpdate`. A host wanting per-frame time would be building a second clock; the transport
is available for that and is already the single source.

## Entity: StageContext

What the stage establishes for everything beneath it. Not React context — CSS custom properties
on the stage element, so the server can set them and a stylesheet can read them.

| Property | Source | Purpose |
|---|---|---|
| `--cs-canvas-w` | aspect ratio | Logical canvas width, e.g. 1600 |
| `--cs-canvas-h` | aspect ratio | Logical canvas height, e.g. 900 |
| `--cs-theme-*` | lesson theme + host override | One property per theme token |

The stage also carries `container-type: size`, which is what makes container query units resolve
against it rather than the viewport (research R-01). An embedded player therefore sizes to its
container, not to the window.

## Entity: ElementVisual

The style properties one element receives. This is the feature's actual output.

| Property | From `ResolvedElement` | Unit |
|---|---|---|
| `--cs-x`, `--cs-y` | `geometry.x`, `geometry.y` | logical units (unitless number) |
| `--cs-w`, `--cs-h` | `geometry.width`, `geometry.height` | logical units |
| `--cs-rotation` | `geometry.rotation` | degrees |
| `--cs-z` | `zIndex` | integer |
| `--cs-opacity` | `opacity` | 0–1 |
| `--cs-tx`, `--cs-ty` | `transform.translateX/Y` | logical units |
| `--cs-sx`, `--cs-sy` | `transform.scaleX/Y` | multiplier |
| `--cs-rotate` | `transform.rotate` | degrees |
| `--cs-brightness` | `filter.brightness` | multiplier, omitted when no filter |
| `--cs-blur` | `filter.blur` | logical units, omitted when no filter |

**Geometry and transform stay separate**, mirroring the kernel. `--cs-x` is where the author put
the element; `--cs-tx` is how far an effect has moved it. The stylesheet composes them. Collapsing
them here would lose the distinction the editor needs in Wave 4, and it would put arithmetic in
the renderer that the stylesheet does for free.

**Why unitless numbers.** The stylesheet converts logical units to container query units:
`left: calc(var(--cs-x) / var(--cs-canvas-w) * 100cqw)`. Emitting `120px` instead would bake in a
scale the server cannot know.

## Entity: ElementRenderer

| Member | Purpose |
|---|---|
| `type` | Registry key, matching the manifest's element type |
| `Component` | Receives a `ResolvedElement`; renders content only |
| `label` | How assistive technology should describe this type when the author gave no label |

A renderer receives the resolved element and **nothing else** — no slide, no lesson, no
transport, no time. Positioning, opacity, and transform are applied by the wrapper, not by the
renderer, so a renderer cannot accidentally become a second place where geometry is decided.

Note this is a *different* contract from the kernel's `ElementPlugin`. The kernel's plugin
resolves an element's contribution; this renders one. Keeping them separate is what stops React
types from reaching `@cuestack/core` (research R-04).

## Entity: FrameWriter

The one place that mutates the DOM outside React.

| Member | Purpose |
|---|---|
| `register(elementId, node)` | A ref callback; the wrapper registers itself |
| `write(state)` | Apply a `RenderState`'s properties to every registered node |
| `stop()` | Cancel the loop |

Isolated deliberately (plan.md Complexity Tracking). Every imperative style write in the package
lives here, so a reviewer can audit the complete set in one file rather than searching for
`ref.current.style`.

## What is deliberately absent

- **No animation state.** Whether an element is animating comes from
  `ResolvedElement.activeEffects` being non-empty (research R-06). A renderer that tracked it
  would be keeping a second model of what is animating, and two models can disagree.
- **No cached styles.** The tempting optimisation is to memoise a computed style per element per
  time. It would make the renderer stateful and the parity guarantee conditional on cache
  correctness.
- **No measured dimensions.** Nothing reads `offsetWidth`, `getBoundingClientRect`, or a resize
  observer. There is nothing to measure, because the stylesheet does the scaling.
- **No media element state.** Video and audio render with native controls in this wave; driving
  their position from lesson time is Wave 3.

## State transitions

The player's own states, which are the transport's plus one:

```
loading ──lesson supplied──> ready ──play──> playing ──pause──> paused
                                                 │                 │
                                                 └───seek──────────┘
                                                 │
                                    last slide advances
                                                 ↓
                                            completed
```

`loading` belongs to the host, not the player: the player receives a lesson synchronously and has
nothing to wait for. It appears here only because a host will show something during its own fetch,
and the distinction is worth naming so nobody adds a loading state to the player that can never
be entered.
