# Contract: `<cuestack-lesson>`

One custom element. Its whole surface is attributes, properties, and events, because that is what the
platform gives a host that is not using a framework.

---

## 1. What this adapter is, and what it is not

**It is a proof.** DX-2 exists to establish that the kernel is framework-agnostic rather than
React-shaped, and it does that by being a second consumer of the same `resolve`, the same clock, and
the same effect implementations.

**It is not a second player.** Media and interactions are out of scope by decision, and four of the
seven element types report themselves unavailable rather than rendering. A host that needs a complete
player wants `@cuestack/react`.

That sentence appears here, in the package description, and in the adapter's own behaviour, because a
host who reads only one of the three is the one this contract exists for.

| Covered | Not covered |
|---|---|
| Slide playback and timing | Media (`video`, `audio`) |
| Effects and transitions | Interactions (`question`) |
| `text`, `shape` | Navigation actions (`button`) — unreachable in **both** adapters today |
| `image`, given an asset resolver | Server rendering — a custom element cannot |

**This table was right before the implementation was.** Slide playback and transitions sat in the
Covered column from the day this contract was written and were absent from `plan.md` and `tasks.md`
throughout — implemented only after the finished adapter was read back against FR-010. A contract
that is not checked against the task list is a contract that can be quietly not built.

### How a slide ends, and what happens between slides

**The advance decision is the kernel's.** `createAdvanceController` from `@cuestack/core` evaluates
it; the element applies the result through `transport.goToSlide`. Nothing here compares
`slideTimeMs` against `durationMs` — that comparison is wrong about `after_media_ends`,
`after_interaction`, and the per-*instance* decision that lets a learner replay a slide.

**No media port is given to the controller.** The null port's honest answer is that media never ends,
so a slide gated on `after_media_ends` is unsatisfiable here and is *reported* rather than skipped.
`completedInteractions` is permanently empty for the same reason: this adapter renders no
interactions, so a learner cannot have completed one.

**The last slide holds.** A lesson that ended by rendering nothing would read as a crash.

**Transitions use `@cuestack/react`'s DOM hooks, not equivalents**, so one host stylesheet themes
both players:

| Hook | Meaning |
|---|---|
| `.cs-transition` | Wraps the two stages; present only while one is running |
| `data-cs-transition="leaving" \| "entering"` | Which half a stage is |
| `data-cs-transition-type` | `fade`, `slide`, or `zoom`, as authored on the slide being entered |
| `--cs-transition-ms` | Duration, so the animation is declarative rather than a re-render per frame |

The leaving half is a frozen clone and carries `aria-hidden="true"`. The transition ends on **lesson**
time — a wall-clock timer would outlive a seek — and ends outright on arrival at a different slide,
because the deadline is measured on the incoming slide's clock and navigating resets it to zero.

Under `prefers-reduced-motion: reduce`, slide and zoom become a fade: **replaced, not shortened**
(BR-015). Fade is left alone, because cross-fading is not movement.

---

## 2. Inputs

```html
<cuestack-lesson src="/lessons/photosynthesis.json" autoplay></cuestack-lesson>
```

```js
const player = document.querySelector('cuestack-lesson')
player.manifest = lesson              // an object, not an attribute
player.resolveAsset = (id) => urls[id]
```

| Name | Kind | Required | Notes |
|---|---|---|---|
| `manifest` | property | one of the two | The lesson. A property because a manifest is an object |
| `src` | attribute | one of the two | Fetched on connect. For a host that would rather write markup |
| `autoplay` | attribute | no | Absent means the host calls `play()` |
| `resolveAsset` | property | no | `assetId` → address. Absent means images report themselves unavailable |

**`manifest` is a property and not an attribute**, deliberately. Serializing a lesson into an HTML
attribute means escaping it, sizing it, and re-parsing it on every mutation — three problems in
exchange for looking tidier in markup.

---

## 3. Methods

`play()`, `pause()`, `seekToSlide(id)`. Nothing else — a proof-scoped adapter offering a rich control
surface would be claiming a completeness it does not have.

---

## 4. Events

A host with no framework has no other way to hear anything.

| Event | When | Detail |
|---|---|---|
| `cuestack:started` | Playback begins | `{ lessonId }` |
| `cuestack:slide` | The slide changes | `{ slideId, index }` |
| `cuestack:completed` | The last slide ends | `{ lessonId }` |
| `cuestack:problem` | Something a learner is seeing is wrong | `{ code, message, slideId, elementId? }` |

All bubble and are composed, so a host can listen on an ancestor rather than on each instance.

**`cuestack:problem` carries the framework's own message**, not a code for the host to translate. The
messages exist and are written for a person; a host inventing its own would be writing worse ones from
less information.

**No event carries anything about the learner.** The same rule `LessonEvent` follows: there is nowhere
for an identifier to go, enforced by the shape rather than by review.

---

## 5. What the host is responsible for

- **Styling the outside.** The element sizes itself to its container; the container is yours.
- **The theme.** Set `--cs-*` custom properties on the element or an ancestor. They inherit through
  the shadow boundary, which is why theming works unchanged from the React player.
- **Assets.** `resolveAsset` is yours, for the same reason it is in the React adapter: a manifest
  carries an opaque id and only you know where the bytes are.
- **Fetching, if you use `src`.** Failures are reported as `cuestack:problem`; the element does not
  retry.

---

## 5a. Author-supplied content is text, never markup

A lesson's text, labels, and alternative text are written by whoever wrote the lesson — and a package
imported from elsewhere may have been written by anybody. All of it reaches the page through
`textContent` and attribute assignment. **Nothing in this adapter assigns `innerHTML`**, enforced by a
lint rule rather than by care (FR-015a), and asserted by a test that renders `<script>` in a text
payload and confirms a learner sees the characters (FR-015b).

Worth stating to a host because the protection is **new here rather than inherited**. The React
adapter never needed to say this: children are escaped by the renderer, and its escape hatch is banned
by a rule whose selectors only exist in JSX. Neither survives the move to a custom element, and the
gap is invisible until somebody writes the code that fills it.

---

## 6. What it will not do

- **Play media.** Out of scope. A `video` or `audio` element reports itself unavailable.
- **Ask a question.** Out of scope. A slide waiting on one reports that it cannot advance rather than
  stranding a learner on it.
- **Render on a server.** A custom element needs a DOM. `@cuestack/react` renders a first slide
  server-side; this does not, and a host needing that wants that.
- **Retry anything, store anything, or hold a credential.**

---

## 7. Multiple instances

Each element owns its own clock, transport, and frame loop, inside its own shadow root. Nothing is
global. Two lessons on one page play independently and neither can reach the other's styles or ids.

The frame loop is cancelled on disconnect. A loop that outlives its element makes a page slower the
longer somebody uses it, and nobody traces that back to a lesson they closed.
