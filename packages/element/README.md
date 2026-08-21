# @cuestack/element

`<cuestack-lesson>` — a Cuestack lesson player as a custom element. No build step, no framework.

```html
<script type="module" src="https://esm.sh/@cuestack/element"></script>

<cuestack-lesson id="player" autoplay></cuestack-lesson>
<script type="module">
  document.getElementById('player').manifest = await fetch('/lesson.json').then((r) => r.json())
</script>
```

Import the module, place the tag, assign a manifest. Importing registers the element, so there is no
setup call to make.

**`autoplay` is not decoration.** Without it the lesson renders its first frame and waits, because
the element does not start itself — a lesson below the fold that began on its own would already have
run past the part nobody saw. Drop the attribute and call `player.play()` when you want it to begin.

## Read this before you choose it

**This is a proof, not a second player.** It exists to demonstrate that Cuestack's kernel is
framework-agnostic rather than React-shaped — the same `resolve`, the same clock, the same effects,
with no React on the page. It is deliberately partial, and the parts it lacks are the parts a real
course needs.

| | `@cuestack/element` | `@cuestack/react` |
| --- | --- | --- |
| Text, shapes, images | yes | yes |
| Slide playback, timing, effects | yes | yes |
| Transitions between slides | yes | yes |
| Video, audio | **no** | yes |
| Questions and interactions | **no** | yes |
| Gestures | **no** | yes |
| Progress, completion, resume | **no** | yes |
| Server rendering | **no** | yes |

Four of the seven element types render as a bordered notice reading *"This video cannot be shown
here."* — a learner is told, in words a screen reader also reads, rather than shown a blank space.

**It does not server-render, and cannot.** A custom element is defined and upgraded by a browser;
there is no `customElements` on a server and no markup to produce without one. The package is safe to
*import* in a server process — the base class resolves to an inert stand-in rather than throwing, so
a shared module graph builds — but it renders nothing until it reaches a browser. `@cuestack/react`
server-renders; this is one of the things you give up by choosing this.

**If a lesson uses anything in the "no" column, host it with `@cuestack/react`.** Use this one for a
lesson you know is text-and-shapes — an embedded explainer in a docs site, a slide on a landing
page — or as the worked example for writing an adapter of your own.

### The one case that needs saying twice

A slide that only continues once a question is answered cannot be left in this player, because this
player will not draw the question. The element detects that and says so — it renders an alert and
fires `cuestack:problem` — rather than leaving a learner on a slide that never ends. It is still a
lesson that cannot be finished here. Check before you embed.

## API

**Attributes**

| Name | Notes |
| --- | --- |
| `src` | A URL to fetch a manifest from, for a host that would rather write markup than script. Failures are reported as `cuestack:problem`; nothing is retried — fetching is yours. |
| `autoplay` | Start on connect. Absent means you call `play()`. |

**Properties**

| Name | Type | Notes |
| --- | --- | --- |
| `manifest` | `LessonManifest \| null` | A property, not an attribute — a lesson is an object, and stringifying one into markup is a size and escaping problem nobody needs. Assigning re-renders. |
| `resolveAsset` | `(assetId: string) => string \| undefined` | Turns an asset id into a URL. Without it, images report themselves unavailable. |
| `ports` | `Pick<Ports, 'time' \| 'visibility'>` | **A test seam, not part of the integration.** It exists so a suite can drive lesson time by hand instead of waiting out real durations. Defaults to the real clock and `document.visibilityState`; a host has no reason to set it. |

**Methods**

| Name | Notes |
| --- | --- |
| `play()` | Begin, or resume. Announces `cuestack:started` once per lesson, not once per resume. |
| `pause()` | Hold. Lesson time stops, so nothing advances and no effect moves. |
| `seekToSlide(id)` | Go to a slide by **id**, not index — an id is what you have, and an index is an implementation detail of the array. An unknown id does nothing rather than throwing at a caller holding a stale reference. |

**Events** — all bubble and are composed, so you can listen on an ancestor rather than on each
instance.

| Name | Detail | When |
| --- | --- | --- |
| `cuestack:started` | `{ lessonId }` | Playback begins |
| `cuestack:slide` | `{ slideId, index }` | The slide changes |
| `cuestack:completed` | `{ lessonId }` | The last slide ends |
| `cuestack:problem` | `{ code, message, slideId? }` | Something a learner is seeing is wrong |

`cuestack:problem` carries the framework's own message rather than a code for you to translate. The
messages are written for a person, and a host inventing its own would be writing worse ones from less
information. No event carries anything about the learner — there is nowhere for an identifier to go.

Add listeners **before** appending the element. A problem on the first slide, and `cuestack:started`
under `autoplay`, are both reported during the first frame; a listener attached afterwards misses
them.

**Exports**

| Name | Notes |
| --- | --- |
| `LessonElement` | The class, for a host that wants to subclass or register it under another name. Importing the package already registers `<cuestack-lesson>`. |
| `COVERED` | The element types this adapter draws: `text`, `shape`, `image`. |
| `NOT_COVERED` | The types it reports as unavailable — derived from the schema's full list, so a type added to the format appears here rather than being silently forgotten. |
| `covers(type)` | Whether a type is drawn. |

The last three exist so you can **decide before you embed** rather than after a learner tells you:

```js
import { covers } from '@cuestack/element'

const playable = lesson.slides.every((slide) => slide.elements.every((el) => covers(el.type)))
```

That check is the programmatic form of the table at the top of this file. If it returns false, the
lesson still plays — the uncovered elements report themselves rather than vanishing — but a learner
will meet a notice where content should be, and `@cuestack/react` is the better host.

## Theming

Set `--cs-theme-*` custom properties on the element or any ancestor. They inherit through the shadow
boundary, so the same properties that theme `@cuestack/react` theme this — the names are checked
against the player's own sources in `test/theme.test.ts`, so the two cannot drift apart silently.

```css
cuestack-lesson {
  --cs-theme-surface-default: #101014;
  --cs-theme-text-default: #f4f4f5;
}
```

Every colour resolves through a token with a readable fallback, so a lesson whose theme omits one
renders plainly rather than invisibly.

## What it shares with the React player

Everything that decides *what is on screen at a given millisecond*: `resolve`, the transport, the
clock and its clamp, and every effect. `test/one-kernel.test.ts` asserts at the source level that
this package defines none of them — a second implementation that agreed today would diverge the
first time the kernel changed, and the test that compared behaviour would still pass.

Reduced motion is the kernel's too. Under `prefers-reduced-motion: reduce` the element applies the
`reduced` variant the kernel computes, rather than disabling animation — a slide-in becomes a fade,
not a jump.

## Writing your own adapter

This package is about 400 lines and is meant to be read. The shape is: subscribe to a transport,
call `resolve` each frame, and turn the resolved elements into whatever your platform draws. See
[docs/authoring-elements.md](../../docs/authoring-elements.md) for the element-plugin side of the
same story.

## Why agreement with the React player is reported, not enforced

`pnpm check:agreement` plays one lesson through both adapters at matched instants and prints what
differs. It always exits zero. That is deliberate, and worth explaining, because Constitution V
requires preview and playback to agree and somebody meeting an ungated comparison here will
reasonably conclude the rule is being quietly ignored.

It is a different comparison. Preview-versus-playback is **one renderer compared against itself** in
two hosts: a difference there is a bug, always, so it gates. Element-versus-React is **two renderers
by design**, over one kernel. This one draws a notice where the other draws a video; disagreement is
the specification. What the report is for is the disagreement that *isn't* — a shared kernel value
that arrives differently in the two, which is a real defect the types cannot catch.

A gate would have to encode which differences are permitted, and that list is exactly the thing that
goes stale. A report a human reads does not.
