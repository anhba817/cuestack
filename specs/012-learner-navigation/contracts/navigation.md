# Contract: how a learner's intent reaches the lesson

## 1. The rule this contract exists to keep

A renderer receives its resolved element, a way to address assets, and — for the types that need
one — a narrow capability. It does **not** receive the lesson, the slide, its siblings, the
transport, or the current time.

This is the same restriction the kernel's plugin contract makes, and for the same reason: a
renderer able to reach the lesson becomes one that does, and then the lesson shape cannot change
without breaking third-party renderers.

**Three implementations of this feature break that rule and all three work.** Adding `transport`
to the renderer's props; calling `usePlayer()` from inside the button renderer; dispatching a DOM
event and listening on the stage. The first two hand a renderer the whole transport. The third
keeps types clean and makes the contract implicit, and the web component would need a second
mechanism anyway. None fails a test today, which is why SC-007 requires the restriction be
asserted structurally rather than reviewed.

---

## 2. `NavigationAccess`

Built per element by the player. `undefined` for every element that is not a button.

| Member | Type | Notes |
|---|---|---|
| `act` | `() => void` | Performs this button's authored action |
| `available` | `boolean` | Whether that action can move from the current position |

**`act` takes no argument.** Which action it performs was decided when the capability was built,
from the element's own payload. A signature like `act(action)` would let the button labelled
*Back* advance the lesson — any renderer holding the capability could perform any action.

**`available` answers questions only the player can answer**: whether there is a slide in that
direction, and whether the lesson would let the learner leave this one. A renderer knows its own
element and nothing about position or about what the slide is waiting for.

**Asked of the kernel, through a query built for asking.** The rule below is not *"call
`evaluate` and see"*: `evaluate` records that a slide has decided, so a speculative call consumes
the decision and the slide never advances again. Its own doc calls it *"a query, not a command"*,
which is true of the transport and false of its own state.

What the kernel gains instead is a pure predicate over `(slide, signals)` — **is anything stopping
a learner who asks to leave right now?** No transport, nothing recorded, safe to call every render:

| | |
|---|---|
| **Not** "would the slide advance now" | A Continue button on a timed slide must work *before* the duration elapses — that is the skip-ahead it exists for |
| **Is** "would anything refuse a learner who asked" | An unanswered required question (BR-005), or a mode that declares its own gate |

Both conditions live in `packages/core/src/advance/conditions.ts` today and reach neither adapter:
core has a single entry point and `index.ts` re-exports only the `AdvanceSignals` type. Exposing
the predicate is what keeps BR-005 in one place rather than three.

**For `next_slide` it is a derivation, not a list.** Available exactly when the lesson permits
leaving — which today means no unanswered required question (BR-005, enforced by the kernel on
*every* advance mode) and no mode-declared gate. Stated as a rule because the list was wrong three
times: it missed that a gated slide can carry the button at all, that "until satisfied" is a
one-frame state, and that BR-005 applies to timed slides too.

**Nothing else is on it.** Not the target index, not the slide count, not where the learner is.
Each of those is a fact about the lesson.

---

## 3. Where it is built and how it travels

Identical to the route a question's answer already takes, because a second pattern for the same
problem is how two mechanisms end up disagreeing.

| Adapter | Built by | Reaches the renderer via |
|---|---|---|
| `@cuestack/react` | `navigationFor(resolved)` in `LessonPlayerClient`, alongside `interactionFor` | `SlideView` spreads it into the renderer's props |
| `@cuestack/element` | `LessonElement`, in the method that already holds the transport | A bound function parameter on `renderElement`, as `resolveAsset` already is |

The web component builds its own rather than sharing: it has no props to thread and no context,
and reaching the player's implementation would mean depending on `@cuestack/react`, which fails
FR-013 structurally.

---

## 4. What each action does

| Action | Transport call | At the boundary |
|---|---|---|
| `next_slide` | See the table below — it depends on the slide's advance mode | Past the last slide, the transport completes the lesson |
| `previous_slide` | `goToSlide(current - 1)` | At the first slide, the transport coerces to `0` |
| `replay_slide` | `goToSlide(current)` | — |
| `open_url` | none — unchanged | — |

### `next_slide` has three behaviours, one per advance mode

| Mode | Press |
|---|---|
| `on_click` | Raise `learnerAdvanced`; the controller decides with cause `learner_action`; the consumer applies it |
| `after_duration` | `goToSlide(current + 1)` directly — **reachable only when `available`**, which is false while a required question is unanswered (BR-005) |
| `after_interaction`, `after_media_ends` | **Nothing at all.** `available` is false for as long as the slide is shown |

**The third row is a correctness requirement, not a nicety.** The format permits a `next_slide`
button on a slide declaring `advance: { mode: 'after_interaction', interactionElementId: 'q1' }`.
Performing the action there carries the learner past the question the slide exists to require —
so an unconditional "the button performs its action" produces a working control that defeats a
gate. A working button that skips a required question is worse than the inert one this feature
replaces.

**This table is `next_slide` only.** `previous_slide` and `replay_slide` are unaffected by a
gate and stay available on such a slide — both move *away* from it, and a learner facing a
required question is precisely who needs to re-read what came before or repeat the current slide.

**Always false, not "false until satisfied".** The slide leaves within a frame of the gate being
satisfied — `controller.ts` decides on the first evaluation where the interaction is complete —
so an availability keyed on gate state is true only in a frame nobody can click in, and a press in
that frame does nothing anyway. Keying it on the *mode* removes the window and means the
capability never needs to know whether a question has been answered.

**`available` describes the lesson, not the tools looking at it.** `Preview.tsx` passes
`overrideAdvance` so a teacher can move through a lesson without answering every question, and the
controller's override short-circuits every rule. It does not change what a control reports: a
teacher previewing sees the button exactly as a learner does. The override moves the lesson.

**Replay is `goToSlide(current)`, never `restart()`.** `restart()` resets the slide clock without
bumping the visit counter; `instanceId` is "slide id plus visit counter"; the advance controller
keys its decided-set on it. A slide replayed through `restart()` stays decided and never advances
again — a learner who pressed Replay would be stuck on the slide they chose to repeat.

**The adapters must not re-implement the boundary checks.** `goToSlide` already clamps both ends
correctly. A second check in an adapter is a second rule that can disagree with the first.

---

## 5. Raising the signal

A press sets `AdvanceSignals.learnerAdvanced` for the evaluation that follows it, and does not
hold it. A flag left raised advances every subsequent slide the moment it is evaluated — a lesson
racing to its own ending, which is the failure `overrideAdvance` records from an earlier feature.

One press is one movement. A double-press, a held key, and a press during a transition each
produce one.

---

## 6. Focus and announcement

| Concern | Status |
|---|---|
| Announcing a slide change | **Already works.** `LessonPlayerClient` keys a live region on the slide index, so it covers changes a learner asks for without any change |
| Placing focus after a change | **Missing.** No file under `player/` contains `.focus()`, `tabIndex`, or `autoFocus` |

When a learner presses a button and the slide changes, the button is removed and focus falls to
`document.body`: the announcement is heard and the learner is nowhere. Focus moves to the
incoming stage, which carries a programmatic focus target.

Two constraints:

- **Not on first render.** Focusing the stage on mount takes focus from the host's page, which no
  learner asked for and a host experiences as the player hijacking their document.
- **Not the leaving stage.** During a transition two stages exist and the outgoing one already
  carries `aria-hidden`.

In the web component the target is inside a shadow root, so a test must read the root's
`activeElement` — `document.activeElement` reports the host element.

---

## 7. What a control that cannot move must do

`aria-disabled`, not `disabled` — the reason `ButtonElement.tsx` already gives: a `disabled`
button leaves the tab order, so a learner using a screen reader would never reach it to hear that
it is inert.

What changes is what it guards. Today it means *this framework has not wired this up*. After this
feature it means *this action has nowhere to go from here* — a fact about the lesson rather than
about the framework.

---

## 8. What this contract does not cover

- **`open_url`.** Untouched, and the only action that works today. The temptation is to route all
  four through one new path; FR-004 exists to prevent it.
- **The lesson format.** No field, no variant, no migration.
- **Anything about the learner.** Intent is momentary and nothing is stored.
- **The three types the second adapter still declines.** `video` and `audio` need media ports;
  `question` needs interaction state and gating. Its stranding report keeps covering them.
