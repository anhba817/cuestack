# @cuestack/react

The React adapter for [Cuestack](../../README.md). Renders a lesson, on a server and in a
browser, from the same computation.

```bash
pnpm add @cuestack/react react react-dom
```

React 19 is a peer dependency. The package does not bundle it — two copies of React in one
page is not a slow page, it is a broken one.

## Rendering a lesson

```tsx
import { LessonPlayer } from '@cuestack/react'
import '@cuestack/react/styles.css'

export function Lesson({ lesson }) {
  return <LessonPlayer lesson={lesson} />
}
```

That is the whole minimum. No provider, no configuration call, no registry to build.

**The stylesheet is not optional.** Positioning, scaling, and theming all live in it, so a
player without it renders every element in the top-left corner. It is imported once, wherever
your app imports CSS.

## The two entry points

One specifier, two implementations, selected by the `react-server` export condition:

| Condition | Component | What it does |
|---|---|---|
| `react-server` | `LessonPlayerStatic` | The frame at time zero. No hooks, no clock, no DOM. |
| default | `LessonPlayerClient` | The same first render, then hydrates and plays. |

Both are exported as `LessonPlayer`, and both under their own names as well, so you can reach
for a specific one when the boundary matters.

The consequence worth knowing: a React Server Component gets a player that *cannot* start a
clock, which is why the server render never disagrees with the client's first pass. They are
the same pure call — `resolve(slide, 0)` — with the same argument.

In a framework with an RSC boundary, mark your own component `'use client'` and render the
player inside it. The package does not mark itself client-only: a library that did could never
be server-rendered by anyone, which is most of the point of this one.

## Props

| Prop | Type | Notes |
|---|---|---|
| `lesson` | `LessonManifest` | Required. Already validated — the player is not a second validator, and shipping one would put a validation library in a learner's browser. |
| `slideIndex` | `number` | Defaults to 0. For deep links. |
| `autoPlay` | `boolean` | Defaults to false. Audible media needs a gesture; false is correct now and stays correct. |
| `elements` | `ElementRendererRegistry` | Defaults to the built-in seven. |
| `theme` | `ThemeValues` | Merged over the lesson's own, so a host can brand a lesson it did not author. |
| `resolveAsset` | `(ref: AssetRef) => string \| undefined` | How to address an asset. See below. |
| `ports` | `Ports` | Time, visibility, storage. Defaults to real browser ports; supply your own to control the clock. |
| `onReady` | `(transport) => void` | The kernel's transport, for driving playback yourself. |
| `children` | `ReactNode` | Chrome inside the player — `<PlaybackControls />` above all. |

## Assets

A manifest carries an opaque `assetId`, not a URL. Where those live is a fact about your
system, so you supply it:

```tsx
<LessonPlayer lesson={lesson} resolveAsset={(ref) => `https://cdn.example.com/${ref.assetId}`} />
```

Without it, an assetId that is already a locator (`https://…`, `/…`, `data:…`) is used as one
and anything else is treated as unresolvable — which renders a reserved-space fallback
carrying the author's description, not a broken image. A publishing pipeline that resolves
these properly is a later wave.

## Controls

```tsx
import { LessonPlayer, PlaybackControls } from '@cuestack/react'

<LessonPlayer lesson={lesson}>
  <PlaybackControls />
</LessonPlayer>
```

Inside the player, not beside it. The controls need the transport, and the transport must stay
singular — a host holding its own would be a second idea of the current time.

To build your own, call `usePlayer()` from any child. It returns the kernel's transport
directly rather than a facade, for the same reason. The transport is `null` until the player
has mounted, which is a state and not a mistake: there is none during a server render.

## Writing a renderer

A renderer receives the resolved element and a way to address assets. Nothing else — not the
slide, not the lesson, not the transport, not the time.

```tsx
const calloutRenderer = {
  type: 'callout',
  label: 'Callout',           // how assistive technology describes this type
  Component: ({ element }) => <div className="my-callout">{element.payload.text}</div>,
}

<LessonPlayer lesson={lesson} elements={createRendererRegistry([...builtinRenderers, calloutRenderer])} />
```

Four things a renderer must not do:

- **Position itself.** The wrapper applies geometry, opacity, and transform. A renderer that
  positioned its own content would be a second place position is decided, and two places
  eventually disagree.
- **Read the clock, or animate.** All timing is already in the element. A renderer with its own
  transition is a second timing implementation, and the divergence would be invisible until an
  editor preview and a player showed different things.
- **Write a colour, font, or spacing literal.** Everything resolves from `--cs-theme-*` with a
  readable fallback. Enforced by lint, because a hard-coded `#333` survives review and then
  survives every theme.
- **Touch the DOM imperatively.** One file does that, so the complete set of style mutations
  can be read in one place.

And two it must: be reachable by keyboard with a name, a role, and a state; and keep its space
when an asset fails, rather than collapsing the layout.

## How scaling works

Every dimension is expressed in container query units against the stage, which carries
`container-type: size`. There is no scale factor computed anywhere, and nothing measures
anything — no `getBoundingClientRect`, no `ResizeObserver`.

That is not an optimisation. A scale factor needs a viewport, a server does not have one, and
a server that guessed would emit a layout the browser then corrected on first paint. Putting
the mechanism in CSS is what makes the server-rendered first frame both possible and correct.

The same indirection pays twice: because every visual value is a custom property, reduced
motion is honoured by a media query, with no script — so it works on the first frame, before
any JavaScript has run.

## What this does not do yet

Questions render, are announced, and cannot be answered. Media renders with native controls
and is not synchronised to lesson time. Navigation buttons carry their action but do not act.
There are no slide transitions and no progress display.

Each of those is a later wave, and each renders something honest in the meantime rather than
appearing to work.
