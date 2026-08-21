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
import { LessonPlayer, PlaybackControls } from '@cuestack/react'
import '@cuestack/react/styles.css'

export function Lesson({ lesson }) {
  return (
    <LessonPlayer lesson={lesson}>
      <PlaybackControls />
    </LessonPlayer>
  )
}
```

No provider, no configuration call, no registry to build.

**Something has to start playback, and it is not the player.** `autoPlay` defaults to false on
purpose — audible media needs a gesture, so a lesson that began on its own would be blocked by the
browser or would talk over a page nobody was looking at. That leaves three ways in, and an example
with none of them renders a correct first frame that never moves:

- `<PlaybackControls />` inside the player, as above — a learner presses play;
- `usePlayer()` from any child, and call `play()` on the transport yourself;
- `autoPlay` on the player, for a silent lesson where you have decided the gesture is unnecessary.

The examples below omit the controls to keep each one about the prop it is showing. They are
fragments, not integrations.

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
| `ports` | `Partial<Ports>` | Time, media, visibility, storage, assets, analytics. Defaults to real browser ports; **merged per member**, so you can override one and keep the rest. |
| `progress` | `'none' \| 'slides'` | Defaults to `'none'`. A host option, not a manifest field — see below. |
| `onReady` | `(transport) => void` | The kernel's transport, for driving playback yourself. |
| `children` | `ReactNode` | Chrome inside the player — `<PlaybackControls />` above all. |
| `overrideAdvance` | `boolean` | **Absent by default, and its absence is the guarantee.** See below. |

### `ports` is a partial, and that matters more than it looks

The player builds its own DOM media port over a frame writer it owns and exposes to nobody, so a
caller who replaced the whole object would lose media: nothing would play, and a slide gated on
`after_media_ends` would stall where a learner advances. Supplying `{ analytics: yours }` keeps
everything else. A full object still wins outright, member for member, which is what lets a test
hand in a scripted media fake and not have it replaced by one reading a DOM with no decoder.

### `overrideAdvance`

Lets every advance gate through — a required interaction, media that has not ended, a click no
player yet delivers. It exists for an editor preview, where a teacher has to be able to reach the
slide *after* the one that would trap them.

**Two independent conditions must hold before anything is bypassed**, and a learner's player
supplies neither: the *presence* of the prop arms the kernel's option, and its *value* raises the
signal. A player mounted without it constructs its controller exactly as it did before this prop
existed. The kernel's own comment is the requirement — "a test affordance that leaks into playback
is worse than none, because it will eventually fire by accident" — and
`test/playback/override-absent.test.tsx` is the guard.

It releases a **gate**, never a slide's length. Turning it on does not skip past durations; a slide
still runs for as long as it was authored to. An earlier draft raised the signal unconditionally and
the lesson raced to its own ending the instant the switch went on.

Named after what it does rather than after who wants it. Nothing in the player knows what an editor
is, and a host with its own reason to skip a gate is not lying about being a preview to get it.

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

## Questions

A question renders as a labelled radio group with a submit control, and answering it is
handled for you. What a host may care about is that **the rule lives in the kernel, not in
the renderer**: whether a required question releases the slide is a fact about lessons, and a
second adapter must reach the same conclusion from the same answer.

Three completion policies, authored per question:

| `completionPolicy` | Complete when |
|---|---|
| `on_first_attempt` (default) | Anything is submitted. |
| `on_correct` | A correct answer is given. |
| `on_attempts_exhausted` | Attempts run out — or a correct answer arrives first, because holding a learner who got it right is a punishment for being right. |

`on_first_attempt` is the default deliberately. A question whose author did not say it must
be answered *correctly* should not trap a learner who got it wrong.

An answer is recorded against the element, not against the visit, so seeking backwards and
returning does not ask again or spend an attempt. The verdict is announced through a live
region and stays on screen briefly before a completed question is allowed to advance the
slide — otherwise the feedback is rendered and replaced within one frame, which is invisible
to everyone including a screen-reader user.

Every answer emits a `LessonEvent` carrying no learner identifier of any kind. A host that
wants attribution correlates on its own side; the framework never sees it.

## Media

Media and the lesson share one clock, and the lesson holds it.

- Seeking the lesson commands the media to the corresponding position, minus the element's
  own start offset.
- Pausing the lesson pauses attached media; hiding the document does the same.
- A learner scrubbing with the element's native controls moves the *lesson* to match — the
  media is not overruled for doing what the learner asked.

Between the two there is a tolerance: media within `MEDIA_SYNC_TOLERANCE_MS` of where it
should be is left alone. Without it, an element's own position reports and the lesson's
corrections chase each other indefinitely.

**Audible media needs a gesture.** Browsers refuse to start it otherwise, so a lesson with
audible media shows a prompt instead of pretending to play and failing silently. Muted media
(`volume: 0` in the manifest) needs no prompt.

## Progress and completion

```tsx
<LessonPlayer lesson={lesson} progress="slides" />
```

Progress counts **slides visited**, not the current index: seeking backwards to re-read
something must not un-earn progress, and a bar that goes down when a learner reviews
punishes reviewing. It is a host option rather than a manifest field because the format
carries no such field and the specification says "where enabled by the teacher or
organization" — a decision that belongs to whoever knows the policy.

After the final slide the player shows a completion state, announced through a live region,
with a way back into the lesson. A lesson that simply stopped would be indistinguishable
from one that broke.

## When a lesson cannot continue

Some lessons stop: media that will not load, a required question this player has no renderer
for, a question that can no longer be completed. The player says so, in the learner's terms —
"the video on this slide", never an element id — and offers what can actually help. A retry
appears only where retrying can change something; where it cannot, the honest answer is a way
past instead.

Authoring problems (`RenderState.problems`) are deliberately *not* shown. A learner can take
no action on an effect that runs past its slide, and being told about it teaches them the
software is talking to somebody else.

## Reduced motion

`prefers-reduced-motion: reduce` is honoured on the **first rendered frame**, including the
one produced on a server that cannot read the preference. That constrains the design more
than it sounds: the choice has to be made by CSS at paint time, and CSS can only choose
between things already in the markup.

So the resolver emits both answers and branches on neither. Every element with an active
moving effect carries its normal visual *and* its reduced one, and a media query picks. This
also keeps `resolve(slide, timeMs)` a pure function of its arguments, which is what makes
seeking equal to playing.

For a custom effect, declare what it becomes:

```ts
const slideIn = {
  type: 'slide-in',
  phases: ['enter'],
  motion: true,
  at: (progress, params) => ({ translate: { x: (1 - progress) * params.distance, y: 0 } }),
  // Substitution, not suppression: a slide-in becomes a fade rather than an
  // instant appearance, and reaches its end state at the same moment.
  reduced: (progress) => ({ opacity: progress }),
}
```

`reduced` is optional three ways: an effect that does not move declares none, a moving one
without it falls back to no motion at all, and one with it gets real substitution. Declaring
`reduced` on a non-moving effect is rejected, since it could never be consulted.

## What this does not do yet

There is no editor and no publishing pipeline. Asset ids are resolved by a host-supplied
function. A lesson is authored as JSON and validated by `@cuestack/schema` before it reaches
the player — the player is not a second validator.

Each of those is a later wave, and each renders something honest in the meantime rather than
appearing to work.
