# Data Model: A learner can move through a lesson

**No change to the lesson format.** All four actions and the `on_click` advance mode have been
in the schema since Wave 1. Nothing here adds a field, a variant, or a migration. What follows
is the runtime shape of things that exist only while a lesson is playing.

---

## 1. The line this feature is drawn on

A renderer receives the resolved element, a way to address assets, and — for the types that
need one — a capability. **Not** the lesson, the slide, its siblings, the transport, or the
time.

That restriction is FR-012, and it is not distrust. A renderer *able* to reach the lesson
becomes one that does, and third-party renderers then break whenever the lesson shape changes.
The capability gives a renderer a verb and no nouns.

---

## 2. `NavigationAccess` — what a button is given

Built per element by the player, `undefined` for anything that is not a button.

| Member | Notes |
|---|---|
| `act()` | Perform this button's authored action. Takes nothing: which action it is was decided when the capability was built, from the element's own payload. |
| `available` | Whether the action can move from here. False for Back on the first slide and Continue on the last. |

**`act()` takes no argument, deliberately.** A signature like `act(action)` would let any
renderer holding the capability perform any action — the button that says *Back* could advance
the lesson. Binding the action at construction means a renderer can do exactly the one thing
its own element declares.

**`available` is a fact about the lesson, not about the framework**, and it answers three
questions rather than one:

| False when | Why |
|---|---|
| Back, on the first slide | There is no previous slide |
| Continue, on the last slide | There is no next slide |
| Continue, on a slide with any unmet condition for leaving | Performing it would carry the learner past something the slide declares — **for as long as that condition is unmet** |

**Asked once, in the kernel.** The predicate is pure over `(slide, signals)` and answers *would
anything refuse a learner who asked to leave right now* — deliberately not *would the slide advance
now*, because a Continue button on a timed slide must work before the duration elapses. It is not
`evaluate`: that records a decision, so asking it speculatively consumes the one the slide needed.

**That third row is a derivation, not a list**, and the difference is why it is written this way.
`next_slide` is available exactly when the lesson would let the learner leave. Two conditions are
known today:

- **A required question not yet answered — BR-005**, which the kernel enforces at
  `controller.ts:107` and whose comment says it *"outranks every automatic condition below. A
  learner who has not answered a required question keeps the slide, whatever the clock says."*
  It applies on **every** advance mode, including `after_duration`.
- **A mode that declares its own gate** — `after_interaction`, `after_media_ends`.

An earlier version of this table enumerated the modes and got BR-005 wrong by omission: it
declared `after_duration` safe for a direct command, which would let a Continue button skip a
required question on a timed slide. The enumeration was wrong three times before that too. A rule
derived from *when the kernel permits leaving* cannot be wrong that way, because the kernel is the
thing being asked.

**Three cases and no more.** Back and Replay stay available on a gated slide: neither carries a
learner *past* anything, and a slide that questions you about its own content is exactly where
you want to re-read the previous slide or repeat this one. A rule written as "navigation is
unavailable on a gated slide" traps a learner in front of a question with no way to review it —
a worse failure than the one the rule prevents.

The transport already clamps the first two: `goToSlide` coerces a negative index to zero and
treats an index past the last slide as completion, so a press at either end is harmless with or
without this field. What `available` adds there is honesty — FR-008 says a control that cannot
move must not present itself as operable.

**The third is different in kind, and it is the one that matters.** A press on a gated slide is
*not* harmless: the format permits a `next_slide` button on a slide declaring
`advance: { mode: 'after_interaction' }`, and performing the action would skip the question the
slide exists to require. **A working button that skips a required question is worse than the
inert one this feature replaces**, and an unconditional reading of "the button performs its
action" produces exactly that.

**Note which path is already safe.** `on_click` raises the signal and the controller checks
BR-005 *before* it reaches the mode branches, so that path cannot skip a required question no
matter what the adapter does. The direct command is the only path that does not consult the
kernel, and it is the only one that has needed a guard. That is an argument for routing through
the kernel wherever a rule exists to route through.

**Always false on a gated mode, not "false until satisfied".** A first version of this rule made
availability a function of gate state, and that state is unreachable: `controller.ts` decides
`after_interaction` on the first evaluation where the interaction is complete, so the slide
leaves within a frame of the learner answering. A control described as available in that frame
would be an available control that does nothing — the original defect, restored for 16ms. Making
it a property of the *mode* removes the window, removes the inconsistency, and removes the need
for the capability to compute gate satisfaction at all.

**And it does not consult the editor's override.** Preview can release advance gates so a teacher
need not answer every question; that release moves the lesson. Availability describes the lesson,
so a teacher sees the control exactly as a learner does, which is what preview is for (FR-003b).

**What it does not carry:** the target index, the slide count, the current position. Each is a
fact about the lesson, and a renderer that could read them would be reading the lesson.

---

## 3. Learner intent

The fact that a learner asked to move on. Momentary — it describes a press, not a state.

It reaches the kernel as `AdvanceSignals.learnerAdvanced`, which has existed since Wave 1 and
has been `false` in every call either adapter has ever made. Nothing about it is stored,
nothing about it is carried in an event, and nothing about it identifies a learner.

**One press is one movement** (FR-009). The signal is raised for the evaluation that follows a
press and not held: a flag left true would advance every subsequent slide the moment it was
evaluated, which is a lesson racing to its own ending — the failure `overrideAdvance`'s own
header records from an earlier feature.

---

## 4. Navigation action

What an authored button does. Part of the lesson format; unchanged here.

| Action | Effect | Satisfies an `on_click` gate? |
|---|---|---|
| `next_slide` | Depends on the slide's advance mode — see below | **Yes** |
| `previous_slide` | `goToSlide(current - 1)`; coerced to `0` at the first slide | No |
| `replay_slide` | `goToSlide(current)` — **not** `restart()`; see below | No |
| `open_url` | Unchanged, and the only one that works today | No |

**`next_slide` means two different things, and on two modes it must mean nothing at all.**

| Slide's advance mode | A `next_slide` press |
|---|---|
| `on_click` | Raises `learnerAdvanced`; the controller decides with cause `learner_action`; the consumer applies it. The kernel's rule is honoured rather than bypassed |
| `after_duration` | Commands `goToSlide(current + 1)` — **only when the control is available**, which excludes an unanswered required question. An author who puts Continue on a timed slide wants a skip-ahead; BR-005 still outranks it |
| `after_interaction`, `after_media_ends` | **Nothing.** `available` is false for as long as the slide is shown — keyed on the mode, not on gate satisfaction — and the press does nothing |

Getting this wrong in either direction produces a defect. Only the first path leaves Studio's
default button — `next_slide`, "Continue", on a slide that is almost always `after_duration` —
inert, which is the defect this feature exists to end. Only the second leaves `learnerAdvanced`
and `learner_action` unproduced, which is the seam-with-no-producer pattern again. **Both without
the third let a learner skip a required question.**

**Only `next_slide` satisfies a gate**, which is the clarified rule behind FR-006. A slide whose
only control goes backwards is a dead end going forwards, and a rule reading "carries a
navigation control" would pass a lesson nobody can finish.

**Replay is `goToSlide(current)` and this is the trap.** `restart()` resets the slide clock
without bumping the visit counter. `instanceId` is "slide id plus visit counter", and
`createAdvanceController` keys its decided-set on it — so a slide replayed through `restart()`
keeps its instance id, stays decided, and **never advances again**. The better-named function is
the broken one.

It also gives FR-010 for free: a new visit is a new decision, so completion is reported again
after a learner replays their way to the end.

---

## 5. What validation gains

`checkReachability` is pure over `(slide, media?)` and already answers this question for two
other modes. `on_click` becomes the third of the same shape.

| Slide | Reported | Severity |
|---|---|---|
| Waits for the learner (`on_click`), carries a `next_slide` button | nothing — it is satisfiable | — |
| Waits for the learner, carries no button at all | `ADVANCE_UNSATISFIABLE`, naming the absence | error |
| Waits for the learner, carries only Back / Replay / a link | `ADVANCE_UNSATISFIABLE`, naming that the controls present do not move forward | error |
| Declares a gate (`after_interaction`, `after_media_ends`) **and** carries a `next_slide` button | that control can never be operated on this slide | **warning** |

**The last row is a warning and not an error**, because the slide is satisfiable through its gate
and is not a dead end. What it prevents is the feature's own defect one level up: after this
change such a control is permanently unavailable, and without the warning a teacher places one,
publishes, and it renders disabled forever with no explanation. The engine already carries
warning-severity findings for authoring mistakes that are not dead ends — `ELEMENT_BEYOND_SLIDE`
is one — so this needs no new mechanism.

**Two messages, not one** (FR-011a). The second case is the easier mistake and the harder to
see: an author looking at a slide with a button on it, reading "no way to continue", will read
that as a bug in the checker rather than in their lesson.

---

## 6. What the second adapter's covered set becomes

`COVERED` gains `button`, leaving `video`, `audio`, and `question` declined — each for a reason
of its own that this feature does not touch.

`covered.test.ts` asserts the partition against the schema's full list and names the excluded
set explicitly, so it fails until updated. That is the right way round: the covered set is
stated in four places — the package description, the README's table, `COVERED`, and the
behaviour — and a change that updates three of them should not be able to pass.
