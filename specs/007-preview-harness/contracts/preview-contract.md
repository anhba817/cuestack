# Contract: The preview surface

**Feature**: `007-preview-harness` · Covers US1–US5 · FR-001–FR-026, FR-029–FR-030

What the preview promises, in the order a reviewer would check it.

---

## 1. It is the player

```text
<Preview session={session} onClose={…} from="beginning" | "slide" | "position" ports={…?} />
  ├─ the frame — OUTSIDE: close, restart, override switch + indicator, viewport preset
  └─ <LessonPlayerClient
       lesson={session.draft}          // the draft as it stands (FR-002)
       slideIndex={startPoint.slideIndex}
       resolveAsset={resolveAsset}     // the editor's own (FR-003)
       overrideAdvance={override}      // the switch's value (FR-017)
       onReady={(t) => t.seek(startPoint.atMs)}   // slide → moment (FR-010); memoised
       ports={{ analytics: discard }}  // a partial: analytics only (§9); a test's full object otherwise
     >
       <PreviewControls … />           // INSIDE: play, pause, seek, prev, next
     </LessonPlayerClient>
```

`ports` is the one prop here that exists for tests, and it is not optional to state — with one
member the preview replaces in production too: `analytics`, per §9. It is passed as a **partial**,
never as a whole `Ports`: the player builds the DOM media port over its own frame writer, which
nothing outside can reach, so replacing the object wholesale leaves the preview silent and stalls
every media-gated slide. The player's fallback becomes a per-member merge for this reason, and a
test handing in a full object still wins outright, as its comment requires. And one it does not carry at
all: `Ports.assets` is declared (`core/src/adapters/index.ts:43`) and read by nobody, since
resolution runs entirely through the `resolveAsset` prop (`SlideView.tsx:48`). Wiring the port would
do nothing. A player given
no ports builds `browserPorts()` internally, so a preview that did not pass them through would have
no clock a test could advance — and Constitution II is NON-NEGOTIABLE about substitutable timing.
`usePlayback` carries the same seam with the same comment: *"Substitutable so a test can
hand-advance the clock."* A production host passes nothing.

**The split is not tidiness; it is the difference between a preview a teacher can leave and one they
cannot.** The player renders `children` inside a ternary:

```text
complete ? <LessonComplete/> : gestureGiven ? children : <GesturePrompt/>
```
(`LessonPlayerClient.tsx:645-651`)

So `children` is **absent at the completion state and behind a gesture prompt**. A Close button
passed as `children` would vanish at the end of the lesson, leaving a teacher who has just watched
their work through with one control: Review, which replays it. The override switch would vanish
with it, at exactly the moment a teacher is judging whether the lesson works.

**The question is what must survive that ternary, not what needs the transport.** The preview holds
the transport in a ref regardless — `onReady` gives it one so the start-point seek can happen — so
the frame can drive it.

Inside go the controls that are only meaningful while the lesson is playing: play, pause, seek,
previous, next. The `children` comment is right about those — "a host holding its own would be a
second idea of the current time".

Outside goes everything that must stay reachable at the completion state and behind a gesture
prompt: close, **restart**, the override switch, its indicator, the viewport preset.

**Restart is the control that makes the distinction matter**, and getting it wrong is easy. It needs
the transport, so a rule about transport access puts it inside — and US3 §7 requires it *at the
completion state*, where inside does not exist. An earlier draft of this contract stated the rule
that way and would have produced the same missing-control defect as the Close button, one control
later.

| Promise | Requirement |
|---|---|
| The preview renders through the player, not a copy of it | FR-001, Constitution V |
| It shows the draft including unsaved changes | FR-002 |
| No player component is forked, wrapped, or reimplemented | FR-001 |
| Controls render as `children`, so host and player share one transport | FR-001 |
| No editor-only affordance appears — no handle, guide, ghost, track, or inspector | FR-004 |
| No editor state reaches it: selection, time scale, open view, authoring time | FR-005 |

FR-004 and FR-005 are the same promise from two sides, and both are kept by *composition* rather
than by suppression. The preview mounts the player, which has never had an overlay to hide; and it
is handed a manifest and a start point, which is the whole of what it receives. There is no code
path that could leak a selection because nothing passes one.

**Why `children` and not a sibling.** The prop's own comment settles it: "controls need the
transport and the transport must stay singular: a host holding its own would be a second idea of
the current time." Feature 006 learned the same thing from the other end, and paid for it.

**The negative promise, and the one worth a named test.** `@cuestack/studio` may gain a preview;
`@cuestack/react` may not gain a preview concept. `no-studio-in-player` and
`check-studio-isolation` both already enforce the direction, and the second proves the stronger
claim by rendering a lesson with the editor absent from disk.

## 2. Assets

| Promise | Requirement |
|---|---|
| The preview resolves assets through the editor's resolver | FR-003 |
| A failing asset shows the player's own recoverable error state | FR-003, FR-PLY-011/012 |
| The canvas and the preview never disagree about what an asset id means | FR-003 |

`EditorCanvasProps` gains `resolveAsset` and passes it to `SlideView`, which has accepted one since
Wave 3. The editor never passed it, so the canvas has always fallen back to
`defaultAssetResolver` — invisible only because the reference lesson's ids are opaque and nothing
serves them. Closing the gap in the editor fixes both surfaces from one place, which is what keeps
the canvas and the preview from disagreeing.

A placeholder would have been cheaper and would have made the preview unable to answer "does this
slide look right", which is most of what a teacher opens it for — and worse, would make a broken
asset look deliberate here and broken in production.

## 3. Where it starts

```text
startPointFor(session, from): { slideIndex: number; atMs: number }
```

**Pure. Node project. No DOM.**

| `from` | `slideIndex` | `atMs` | Requirement |
|---|---|---|---|
| `beginning` | 0 | 0 | FR-008 |
| `slide` | the editor's current slide | 0 | FR-009 |
| `position` | the editor's current slide | `session.authoringTime` | FR-010 |

| Promise | Requirement |
|---|---|
| Captured **once**, when the preview opens | FR-012 |
| Playback continues through the lesson from there, obeying each slide's advance rule | FR-011 |
| Restart returns to the preview's start, not the lesson's | FR-012 |
| An unknown slide id falls back to index 0 rather than throwing | edge case |

"Once" is doing three jobs: a value that cannot change cannot drift (FR-012), the editor is never
modified so closing restores nothing (FR-006), and everything after the seek belongs to the player
(FR-011).

## 4. Driving it

| Promise | Requirement |
|---|---|
| Play, pause, seek, previous slide, next slide, restart, close | FR-013 |
| Previous and next unavailable at the ends, and saying why | FR-014 |
| Reaching the end shows the player's own completion state | FR-015 |
| The preview stays open, and its frame stays reachable there | FR-013, FR-015 |
| Close, **restart**, and the override switch survive the completion state and the gesture prompt | FR-013, FR-019 |
| Restart from the completion state replays from the preview's start | FR-012, US3 §7 |
| Restart replays into a **fresh** lesson: questions unanswered, gates re-armed | FR-032 |
| Previous and next keep the answers — navigation within one run, not a restart | edge case |
| Every control keyboard-operable, named, with a visible focus indicator | FR-016 |

Play, pause, and seek come from `PlaybackControls`, which exists. Previous and next are
`transport.goToSlide`, which exists. **Completion is rendered by the player itself**, so the preview
must not render a second one — what it owes at that moment is to stay open with its frame intact.

**Restart is a fresh run, not a seek**, and that is a mechanism rather than a preference. The
learner's answers live in `useInteractions`' state, whose interface exposes no reset; the advance
controller's decisions are keyed by `instanceId`, which `restart()` does not move. So the preview
keys the player on a restart counter and lets the remount discard interaction state, controller, and
transport together — `onReady` re-seeks to the captured start point through the path that already
exists. A restart implemented as a seek would replay a lesson in which every gate is already
satisfied, and "does that question actually stop it?" is half of why a teacher restarts.

Previous and next are the opposite case and deliberately so: `goToSlide` bumps the visit count, so
the controller re-decides the slide while the answers persist — which is what a learner moving
within one run would experience.

What this feature writes is the arrangement, and the controls the player has no opinion about: close,
restart, and the override switch. All three belong to the frame, for the reason in §1 — restart
especially, since the player's own restart returns to the slide's zero and US3 §7 needs it at the
completion state.

## 5. The override

| Promise | Requirement |
|---|---|
| One switch, letting **every** gate through while on | FR-017 |
| Off at every open | FR-018 |
| Reaching a late slide costs one action, not one per gate | FR-017, SC-008 |
| Turning it off restores every gate immediately | FR-020 |
| The preview says gates are ignored **continuously**, not once | FR-019 |
| Nothing about it is written to the lesson | FR-018, SC-008 |
| A learner's player cannot override anything | FR-018 |

**The last row is the one to check first.** `allowOverride` and `signals.overrideAdvance` must
*both* be true for the controller to short-circuit, and a learner's player supplies neither: the
new prop is absent, so the option is false and the signal is never set. The option's own comment is
the requirement — "a test affordance that leaks into playback is worse than none, because it will
eventually fire by accident" — and two independent falsehoods are the answer to it.

The comment changes from "test-only" to "test and preview". That is a documentation change to a
contract that anticipated this consumer: FR-ADV-011 predates Wave 1.

## 6. Reachability

```text
controller.reachability(slide) → BlockingProblem | null
```

The preview asks; it does not detect. `checkReachability` has existed since Wave 1 and its comment
states the case: "without this, a learner staring at a stalled slide and a learner on a
deliberately-manual slide look identical." Wave 3 showed it to the learner. This shows it to the
author.

| Promise | Requirement |
|---|---|
| A lesson that cannot be completed names the slide and the reason | FR-021 |
| The wording is the kernel's, not a second message | FR-021, NFR-USA-004 |
| The editor implements no detection of its own | Constitution V |
| Blocking a *publish* remains PB-1's | out of scope |

## 7. Size

| Promise | Requirement |
|---|---|
| Desktop, tablet, and mobile sizes | FR-022 |
| Only the rendered **size** changes; the proportion cannot | FR-023 |
| No stored geometry changes | FR-023, FR-CAN-017 |
| Tablet and mobile show the lesson where the type floor takes effect | FR-024 |
| The preset does not survive the preview | SC-005 |

The preset sets the width — not a maximum — of the preview's **own viewport wrapper** around the
player, never of the stage: `LessonPlayerClient` returns no wrapping element of its own, and
`.cs-stage` *is* the container (`container-type: size; container-name: cs-stage`), so a control in
the frame both cannot and must not style it.

**A maximum would size nothing**, because §8's modality makes the preview a `<dialog>`, whose UA
rendering is `width: fit-content`. The dialog would size to its contents, a `max-width` on the
wrapper would cap something with no width of its own, and the stage's `width: 100%` would resolve
against a fit-content ancestor — leaving the preview as wide as the control row. So the dialog takes
the viewport with `max-width: none`, and the wrapper takes `width: <preset>; max-width: 100%`. It does not need to — geometry is logical and the stage scales through
container query units, so constraining the wrapper makes the lesson rescale itself. FR-023 is
structural, and its test compares a manifest rather than a layout.

**Size, not proportion, and the difference is not pedantry.** `.cs-stage` declares
`aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h)`, so the lesson's shape is fixed by its
canvas; a preset makes it smaller and never a different shape. And since every dimension beneath is
in `cqw`/`cqh` against that same canvas, a smaller preview is otherwise the same picture — nothing
reflows, nothing repositions.

What does change is the legibility floor, and it is the whole of this section's value. Type is
`max(12px, var(--cs-theme-font-size, 32) / var(--cs-canvas-w) * 100cqw)`, and a 16:9 canvas is
1600 × 900, so the floor takes over below **600 px** for body text, **960 px** for captions, and
**800 px** for UI text. Below those widths type stops shrinking with the canvas and grows relative to
the box it was authored in. So the preset widths are chosen against the floors rather than against
device marketing numbers, and derived from the canvas — a 9:16 lesson is 900 wide and its floors sit
elsewhere. A preset that sat above every floor would satisfy every other row of this table while
showing the teacher nothing.

Deliberately *not* emulation: no touch simulation, no user-agent spoofing, no device chrome.
Emulation that is not faithful is worse than none, because it invites conclusions it cannot support.

## 8. Closing, and read-only

| Promise | Requirement |
|---|---|
| The editor returns to the slide, selection, and authoring time it held | FR-006 |
| Focus moves into the preview on open and back to the opener on close | FR-007 |
| Closing while playing stops the clock | edge case |
| **Opening** while the editor is playing stops the editor's clock | edge case, FR-006 |
| The editor behind is unreachable, not merely covered | FR-030 |
| The preview cannot modify the draft | FR-026 |
| It remains available in read-only mode | FR-029 |

FR-006 is the absence of a code path rather than a restore: the preview never touches the session,
so there is nothing to put back and nothing that can put it back wrongly. **Two rows above are what
keep that absence honest**, and neither is free.

*Unreachable is not the same as covered.* Tab does not respect z-index. Every key handler in the
studio is element-scoped, so focus is the entire path into an edit: one Tab out of the preview and
one arrow key nudges an element, invisibly, since the preview holds the draft as it stood at open.
The preview is therefore a `<dialog>` opened with `showModal()`: the platform puts it in the top
layer, makes everything outside inert, contains focus, and closes on Escape. Two things come with
it and are easy to miss: the UA's `width: fit-content` must be overridden, or §7's preset has
nothing to act on; and the dialog needs an accessible name of its own, which the a11y gate will not
ask for — `aria-dialog-name` is tagged `best-practice` and the suite runs only the WCAG tags. `inert` on the editor
is not an option — the studio exports parts a host composes and has no editor root to mark.

*The editor's clock does not stop by itself.* `usePlayback` ticks for as long as its state is
`playing`. A preview opened mid-playback would run two clocks over one slide and the authoring time
would move while the teacher watched — so FR-006 would need the restore code this contract says it
does not. Opening calls the session playback's `pause()`, which commits the moment through the one
write path already.

Focus follows feature 005's delete confirmation, which takes focus on open and returns it on close
with a test for each half — but needs one rule that confirmation did not, because the split chrome
gives the preview two focusable regions. **Opening moves focus to the frame; closing returns it to
the Preview button, wherever focus was inside** — including in the player's controls or the
completion state.

FR-029 is the one place read-only *widens* rather than narrows. A reviewer who cannot preview cannot
review (FR-COL-001), and the preview writes nothing, so there is nothing to forbid.

## 9. What never leaves the preview

Start point, override switch, viewport preset, whether a preview is open, transport state — none of
these reach a manifest. SC-005 verifies by saving and comparing. Features 005 and 006 each added
values to this invariant; this one adds four more and must not be the feature that breaks it.

**The manifest is not the only way out, which is why this section is no longer named after it.**
The player records `lesson_started` on mount and `slide_started`, `slide_completed`, and
`lesson_completed` as the lesson runs (`LessonPlayerClient.tsx:326`, `:376`, `:470`, `:477`). A
preview mounts the player unmodified, so without a decision it reports a teacher's checking as a
learner's progress — and under the override, completions nobody earned.

| Promise | Requirement |
|---|---|
| No preview state reaches a manifest | SC-005, FR-018 |
| No preview activity reaches the host's analytics | FR-031 |

The preview passes a partial `ports` of `{ analytics: discarding }` — and a partial, not a whole
object, because a whole one would take the DOM media port with it (§1). It is inert today, because
`browserPorts()` uses the in-memory adapters — and that file names the path out of that: "a host
that wants persistence supplies its own ports". A structural answer costs one line and does not
depend on anyone remembering.
