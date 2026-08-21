# Research: A learner can move through a lesson

Nine findings. Four change the design, three settle an open question, and two are pre-existing
behaviour that turns out to already satisfy a requirement.

---

## R-01: The route for learner intent already exists, one type over

**Decision.** Carry the learner's intent the way a question's answer is already carried: a
narrow capability built per element by the player and handed to the renderer as a prop.

`LessonPlayerClient` builds `interactionFor(resolved)`, which returns `undefined` for anything
that is not a question and otherwise a three-member object closing over the transport and the
interaction state. `SlideView` calls it per element and spreads the result into the renderer's
props. The renderer receives a `submit` function; it never learns that a transport exists.

Navigation is the same shape: `navigationFor(resolved)` returns `undefined` for anything that
is not a button, and otherwise something a button can call. The button renderer gains a prop
and loses nothing.

**Rationale.** FR-012 forbids handing a renderer the lesson, the slide, the transport, or the
time — not out of distrust, but because a renderer *able* to reach the lesson becomes one that
does, and third-party renderers then break whenever the lesson shape changes. A per-element
capability gives a renderer exactly the verb it needs and no noun at all.

**Alternatives considered.** Passing the transport into `ElementRendererProps` (the obvious
move, and the one FR-012 exists to prevent). A DOM event bubbling from the button to the player
(works, but makes the contract implicit and untypeable, and the web component would need a
second mechanism anyway). Context (`usePlayer()` from inside a renderer — available today, and
it hands the renderer the whole transport, which is the thing being avoided).

---

## R-02: `replay_slide` must not use `restart()`

**Decision.** Implement replay as `goToSlide(currentIndex)`, not `transport.restart()`.

**Rationale, and it is the sharpest finding here.** Both reset the slide clock to zero, and the
names suggest `restart()` is the one meant for this. It is not:

- `goToSlide(index)` calls `bumpVisit(index)` before resetting the clock.
- `restart()` resets the clock and nothing else.

`instanceId` is documented in the transport as *"slide id plus visit counter — the single-fire
key"*, and `createAdvanceController` keys its `decided` set on it. So a slide replayed through
`restart()` keeps the instance id it already had, the controller still holds it as decided, and
**the slide never advances again**. A learner who pressed Replay would be stuck on the slide
they chose to repeat — the exact failure this feature exists to remove, reintroduced by picking
the better-named function.

It also settles US3 scenario 4: completion is reported again after a replay because the new
visit produces a new decision, which is the same mechanism that made the element adapter's
`#announcedComplete` flag wrong in feature 011.

**Alternatives considered.** `restart()` (wrong, as above). Adding a `replay()` to the
transport (a third method that would do what `goToSlide(current)` already does).

---

## R-03: The transport already clamps both ends correctly

**Decision.** Do not add bounds checks in the adapters. `goToSlide` handles both ends.

- `index >= lesson.slides.length` stops the clock and sets state to `completed`.
- `index < 0` is coerced to `0`.

So `next_slide` on the last slide completes the lesson, and `previous_slide` on the first stays
put — US1 scenario 3 and US3 scenario 2 are satisfied by code that already exists. What the
adapters must not do is duplicate the check and disagree with it.

**What still needs building:** FR-008's second half. A control that cannot move must not
*present* itself as operable. The transport's clamping makes the press harmless; it does not
make the button honest.

---

## R-04: The player already announces slide changes; focus is what is missing

**Decision.** Add focus placement. Do not add a second announcement.

`LessonPlayerClient` tracks `announced !== snapshot.slideIndex` and updates a live region that
is *"announced to a screen reader and invisible to everyone"*. That satisfies FR-007 for every
slide change, including ones the learner asks for — it is keyed on the index, not on the cause.

No file under `packages/react/src/player/` contains `.focus()`, `tabIndex`, or `autoFocus`.
When a learner presses a button and the slide changes, the button is removed and focus falls to
`document.body`: the announcement is heard and the learner is nowhere.

The fix is a programmatic focus target on the stage — `tabindex="-1"` and a `.focus()` when the
slide index changes. Two constraints found while looking:

- **Not on first render.** Focusing the stage on mount steals focus from the host's page, which
  a learner did not ask for and a host would experience as the player hijacking their document.
- **Not on the leaving stage.** During a transition two stages exist, and the outgoing one
  already carries `aria-hidden`. Focus must land on the incoming one.

**Alternatives considered.** A second live region announcing the arrival (double-announces
against the existing one). Focusing the first interactive element (places the learner at the
Continue button of a slide they have not been shown).

---

## R-05: `checkReachability` is slide-local, and so is the new rule

**Decision.** Extend `checkReachability` with an `on_click` branch that looks for a `button`
element on the slide whose action is `next_slide`.

The function is pure over `(slide, media?)` and its existing branches already do exactly this
shape of work: `after_media_ends` finds the named element and checks its type;
`after_interaction` does the same for interactions. Both return `ADVANCE_UNSATISFIABLE` with a
message naming what is missing. The new branch is a third of the same, and it needs nothing the
function does not already have.

**The test that must change, and why it is the risky one.**
`packages/core/test/advance/unsatisfiable.test.ts` contains:

> `it('reports nothing for the two rules that cannot be unsatisfiable', ...)` — over
> `['after_duration', 'on_click']`

That assertion is a *negative*, and a negative assertion is where a wrong change hides: relaxing
it to accept the new behaviour is a one-character edit that also stops it catching anything.
`after_duration` genuinely cannot be unsatisfiable and must stay in a test that says so;
`on_click` moves out and gets its own cases, both directions.

---

## R-06: Two distinct failures, one message each

**Decision.** FR-011a's distinction is not cosmetic, and the message must name the actual fault.

A slide that waits for the learner can fail two ways:

1. It carries no navigation control at all.
2. It carries controls, and none of them moves forward — a Back button, a Replay button, or an
   `open_url` link.

The second is the easier mistake and the harder to see: an author looking at their slide sees a
button and a message reading "no way to continue" will read as a bug in the checker. The
messages must differ, and the second must say that the controls present do not move the learner
forward.

---

## R-07: The web-component adapter needs the same route, built differently

**Decision.** `button` joins `COVERED`. The adapter renders a real `<button>` and calls the same
kind of narrow capability, constructed by `LessonElement` rather than passed as a prop.

`renderElement(element, doc, resolveAsset)` has no route for intent today — it takes a document
and an asset resolver and returns a node. It gains one parameter of the same character as
`resolveAsset`: a function the element supplies, bound per element, that performs the authored
action. The adapter's own `#advanceIfDue` already holds the transport and the controller.

**What widens with it.** Four places state what that adapter does not do, and all four must
agree afterwards: `package.json`'s description, the README's table, `covered.ts`'s `COVERED`
and its comment, and the behaviour itself. `covered.test.ts` asserts the partition is exhaustive
and names the excluded set explicitly, so it fails until updated — which is the right way round.

**What does not widen.** `video`, `audio`, and `question` keep their own reasons, and the
adapter's stranding report keeps covering a slide gated on a question it cannot draw.

---

## R-08: Focus, replay, and the element adapter's own frame loop

**Decision.** The web component needs the same focus placement as the player, and it is easier
there: it owns its shadow root and draws the stage itself.

A caveat found while reading it: the adapter clears and rebuilds `#nodes` on slide entry, and
the stage element itself persists across slides. So the focus target is stable and the placement
is a `.focus()` at the same point `#enterSlide` already runs — with the same not-on-first-slide
rule as R-04, and inside a shadow root, where `document.activeElement` reports the host and the
root's own `activeElement` reports the real target. Any test asserting focus must read the
shadow root's, not the document's.

---

## R-09: The button renderer's inert affordance already has the right shape

**Decision.** Keep `aria-disabled` and remove the reason for it.

`ButtonElement.tsx` renders navigation actions with `aria-disabled` rather than `disabled`, and
its header explains why: *"a `disabled` button leaves the tab order, so a learner using a screen
reader would never reach it to hear that it is inert. Announcing an inoperable control is worse
than announcing why it is inoperable."*

That reasoning is right and stops applying to navigation actions once they work. It starts
applying to something else: FR-008 requires a control that cannot move — Back on the first
slide, Continue on the last — not to present itself as operable. The mechanism stays; what it
guards changes from "this framework has not wired this up" to "this action has nowhere to go
from here", which is a fact about the lesson rather than about the framework.
