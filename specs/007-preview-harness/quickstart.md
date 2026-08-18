# Quickstart: Validating the Preview Harness

**Date**: 2026-08-18 · **Feature**: `007-preview-harness`

How to prove this feature works.

**These commands are written against the layout in [plan.md](./plan.md) and have not yet been
run** — the implementation does not exist. A task at the end of the run executes every one of them
verbatim and corrects whatever this document got wrong. Feature 004's pass found three commands that
matched no test files at all; feature 006's found an ordering hazard in the gate self-test. The pass
is the point, not the prose.

## Prerequisites

Node 22.12+, pnpm 11, `pnpm install && pnpm build`. No new workspace packages and no new toolchain
dependencies. Two props added outside this feature's own directory:
`LessonPlayerClientProps.overrideAdvance` and `EditorCanvasProps.resolveAsset`.

**Rebuild the kernel before a full run, and again after one.** `pnpm gates` and the `gates` test
project both write temporary fixtures into `packages/core/src`, which leaves the React suite's
freshness check seeing a stale `dist`. Feature 006's pass found this and it is not this feature's:

```bash
pnpm exec turbo run build --filter @cuestack/core --force
```

---

> **Executed verbatim during implementation.** Every command below runs and passes as written.
> Three corrections were made in the process and are marked *(corrected)* where they appear: §5
> gained the analytics row and its control, §7 gained the fresh-run assertion, and a new §9a covers
> two suites the first draft never named. §14 records the numbers the pass produced.

## 1 — The start point, with no browser at all

```bash
pnpm exec vitest run --project @cuestack/studio-pure startPoint
```

**Expected**: the three ways to open produce the three shapes — beginning is `(0, 0)`, current slide
is `(slide, 0)`, current position is `(slide, authoringTime)` — and an unknown slide id falls back
to index 0 rather than throwing.

This is pure and belongs in the `node` project, which is also the assertion: a start point is a
lookup and an arithmetic, and if it needs a DOM something has been threaded that should not have
been.

## 2 — The preview is the player

```bash
pnpm exec vitest run --project @cuestack/studio preview/mounts
```

**Expected**: the preview renders lesson content, and **no editor markup at all** — no
`.cs-overlay`, no `.cs-track`, no `.cs-timeline`, no inspector.

**The assertion to write as a negative.** "Looks like the player" is not checkable; "contains no
element carrying an editor class" is. SC-004 is worded that way for the same reason.

**Negative control**: render the editor canvas instead and confirm the same query finds plenty. A
test that would pass against an empty document is not testing anything.

## 3 — Where it starts, and where restart returns to

```bash
pnpm exec vitest run --project @cuestack/studio preview/start
```

**Expected**: previewing from the current position begins at that moment on that slide; playing on
runs into the next slide under its own advance rule; and **restart returns to the preview's start,
not the lesson's**.

**If the preview appears to restart itself continuously, look at `onReady` before looking at the
clock.** The player's mount effect lists `onReady` and `ports` among its dependencies, so an inline
arrow gives a new identity every render and rebuilds the transport, the controller, and the writer
each time. It presents as a timing bug and is a dependency one.

That last one is FR-012 and is the assertion most likely to be got wrong by reusing the player's own
restart, which returns to the *slide's* zero. The preview's restart is a seek to the captured start
point.

## 4 — Assets resolve as they do for a learner

```bash
pnpm exec vitest run --project @cuestack/studio preview/assets
```

**Expected**: a host resolver supplied to the editor reaches the preview, and a resolver that
returns nothing produces the player's own recoverable error state rather than a placeholder.

**Negative control**: pass no resolver at all and confirm the fallback is
`defaultAssetResolver` — the behaviour the editor has had since Wave 3, and the reason this gap was
invisible.

## 5 — The override, in all four of its promises

```bash
pnpm exec vitest run --project @cuestack/studio preview/override
```

| Assertion | Source |
|---|---|
| One switch lets a **second and third** gated slide through without asking again | FR-017, SC-008 |
| It is off at every open | FR-018 |
| Turning it off restores every gate immediately | FR-020 |
| The preview says gates are ignored continuously, not once | FR-019 |
| The lesson afterwards is byte-identical | SC-008 |
| The analytics adapter recorded **nothing** *(corrected: the control below was missing)* | FR-031 |

That last row is the one to read twice. The player records `lesson_started`, `slide_started`,
`slide_completed`, and `lesson_completed`, and the preview mounts it unmodified — so every gate the
override skips would otherwise report a completion no learner earned, indistinguishable from a real
one. The preview passes a discarding `analytics` adapter (R-09). It passes trivially against
`browserPorts()`'s in-memory adapters; it earns its keep the day a host wires real telemetry.

**And it needs a control, which the first draft of this section did not have.** An empty event list
proves nothing on its own — a broken recorder, a player that never started, and a fixture with
nothing to report all produce one. The suite mounts the same ports on `<LessonPlayer>` directly and
asserts they *do* fill.

**And a manual check that no assertion here covers**: preview a lesson with audio and confirm you
can hear it. The analytics adapter is passed as a *partial* `ports` precisely so the player still
builds its own DOM media port; a preview handed a whole `Ports` object would render correctly, play
nothing, and stall on any slide gated by `after_media_ends` — a failure that looks like the lesson's
fault. Add it to §15's manual pass.

**The negative control that matters most**: mount `LessonPlayerClient` **without** the
`overrideAdvance` prop, raise every signal a preview would raise, and confirm a gated slide does not
advance. Two conditions must both hold for the controller to short-circuit, and a learner's player
supplies neither — the option's own comment demands exactly this ("a test affordance that leaks into
playback is worse than none, because it will eventually fire by accident").

## 6 — A lesson that cannot be finished

```bash
pnpm exec vitest run --project @cuestack/studio preview/reachability
```

**Expected**: a slide that advances on media it does not contain is reported to the *teacher*,
naming the slide and the reason, in the kernel's own wording.

The editor detects nothing here. `checkReachability` has existed since Wave 1 and Wave 3 wired it to
the learner; this is its second consumer, not its second implementation.

**A lesson with audible media shows the gesture prompt first**, because `needsGesture = autoPlay &&
hasAudibleMedia(lesson)`. That is correct — it is what a learner gets, and browsers require it — and
it is noted here so it is not read as the preview failing to start.

## 7 — Reaching the end

```bash
pnpm exec vitest run --project @cuestack/studio preview/completion
```

**Expected**: playing to the end shows the lesson's completion state, the preview **stays open**, the
preview's own Restart is **reachable there** and replays from the preview's start — **and it replays
into a fresh lesson**: answer the required question first, then restart, and the question gates the
slide again.

Reachable is the operative word. Restart lives in the preview's frame, outside the player, because
`children` is replaced at the completion state — a restart placed inside would be missing at exactly
the moment this section exercises it.

**Fresh is the other operative word, and it is the assertion a correct-looking implementation
fails.** A restart written as a seek satisfies everything above: right position, right control, right
moment. It replays a lesson whose gates are all already satisfied, because the answers live in the
player's interaction state with no reset and the advance controller never re-decides a slide whose
`instanceId` has not changed — and `restart()` does not change it. The preview keys the player on a
restart counter instead (R-10). Going **back** with previous is the opposite case and deliberately
so: the answer stands, exactly as it would for a learner moving within one run.

The completion screen's own "Review" button does something different — `goToSlide(0)` then `play()`,
the *lesson's* beginning. That is deliberate: it is the lesson's affordance behaving as a learner's
would, which is what a preview exists to show. Two buttons doing different things is only confusing
if neither says which.

Driven by an injected `TimeSource` through `runFrames` — never by waiting. Constitution II forbids
wall-clock sleeps, and feature 006's harness already does this.

## 8 — Size

```bash
pnpm exec vitest run --project @cuestack/studio preview/viewport
```

**Expected**: each preset sets the width of the preview's viewport wrapper and changes **nothing
else** — the manifest is byte-identical before and after, and the aspect ratio is untouched — and
each preset's width sits on the correct side of the player's type floors.

**Why the last one is the point.** A preset cannot change the lesson's proportion: `.cs-stage`
declares `aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h)`, and every dimension beneath it is
in `cqw`/`cqh` against that same canvas. A narrower preview is the same picture, smaller — nothing
reflows, nothing repositions. The single exception is the legibility floor: body text is
`max(12px, 32/1600 · 100cqw)`, which stops shrinking below **600 px**, captions below **960 px**,
UI text below **800 px**. So at tablet the captions and UI labels are already proportionally larger
than authored, and at mobile the body text is too — and *that* is the question a teacher opens this
preset to answer. A viewport test with no number in it asserts that nothing happened.

A width, not a maximum: the preview is a `<dialog>`, whose UA rendering is `width: fit-content`, so
a maximum would cap an element that has no width of its own and the preview would end up as wide as
its control row.

happy-dom computes no layout, so this asserts the wrapper's declared width, the manifest's equality,
and the arithmetic — not a rendered size. Saying which of the two is being checked is the difference
between a test and a decoration.

## 9 — Closing, focus, and read-only

```bash
pnpm exec vitest run --project @cuestack/studio preview/lifecycle
pnpm exec vitest run --project @cuestack/studio preview/read-only
```

**Expected**: closing returns the editor to the slide, selection, and authoring time it held; focus
moves into the preview on open and back to the opener on close; closing while playing stops the
clock; and in read-only the preview opens and plays while the editor stays unmodifiable.

**Two assertions to check before the rest, because they are the ones this feature nearly got
wrong.** The close control must be reachable **at the completion state** and **while a gesture
prompt is showing**. The player replaces `children` at both moments
(`LessonPlayerClient.tsx:645-651`), so a preview whose frame lived there would strand a teacher at
the end of their own lesson with nothing but Review — which replays it. The same applies to the
override switch — it must be turn-off-able at the moment a teacher is judging whether the lesson
works — and to **restart**, which US3 §7 requires from the completion state.

FR-006 should need no restore code. If the implementation grew a snapshot to put back, the preview
touched the session and the modal promise leaked. **That invariant holds only because opening stops
the editor's clock**: `usePlayback` ticks for as long as its state is `playing`, so a preview opened
mid-playback would leave a second frame loop running over the same slide and the authoring time
would move while the teacher watched. Open a preview while the editor is playing and confirm the
editor pauses at that moment.

**Then try to edit through it**, in a real browser — this is one for the manual pass in §15. Tab
from the last control in the preview's frame. It must not reach a timeline bar or a canvas handle:
the preview is a modal `<dialog>`, so the platform holds everything outside it in the top layer's
shadow (FR-030). Every key handler in the studio is element-scoped, so focus is the whole gate — one
Tab and one arrow key would nudge an element by `NUDGE_MS`, and the preview would not show it,
holding the draft as it stood at open. happy-dom implements `showModal()` but not the top layer, so
the automated test asserts the mechanism and the browser confirms the effect.

## 9a — Driving it, and the boundaries

```bash
pnpm exec vitest run --project @cuestack/studio preview/controls
pnpm exec vitest run --project @cuestack/studio preview/draft
pnpm exec vitest run --project @cuestack/studio preview/immutability
```

**Expected**: pause holds the moment; previous and next each play from that slide's start; both are
*unavailable* at the ends of the lesson and **say why** rather than doing nothing; an unsaved edit
appears in a preview opened afterwards; and no file under `src/preview/` can reach `session.apply`,
the reducer, or any other mutation path.

That last one is a source check on purpose. A behavioural test shows the preview *did not* change a
lesson; only the source shows it *could not*, and that is what FR-026 asks for.

## 10 — Parity, and the gate

```bash
pnpm exec vitest run --project @cuestack/studio parity
node tools/scripts/gates/parity.mjs
```

**Expected**: the existing parity suites pass, and the new one shows the question element saying the
same thing statically and interactively — the same prompt, options, and geometry — while only the
interactive set carries a submit control.

**Read the target before trusting a green line**, because this feature aimed at it twice and missed.

Not preview against playback: the preview mounts `LessonPlayerClient` unmodified, so the two are one
component — and written as `resolve(slide,t) === resolve(slide,t)` it compares a pure function with
itself and passes forever, including after parity breaks.

Not canvas against player either: **feature 005 already wrote that**. `overlay.test.tsx` asserts the
editor's render layer is byte-identical to the player's with the overlay subtracted, across all
seven types, with a selection active and with a ghost present — and carries the guard *"changes with
time, so the equality above is not vacuous"*, which is the same tautology anticipated a whole
feature earlier.

What is left is one element. The two renderer sets are the same seven objects except
`staticQuestionRenderer` against `questionRenderer`, so the question element is the whole surface —
and it is exactly where feature 005's real divergence was, the submit control on a canvas that
should not have had one.

**The negative control, and this feature does not ship without it.** Make `staticQuestionRenderer`
disagree with `questionRenderer` about the question's *content* — not its controls, which differ
legitimately — and confirm the gate goes red naming the element type. A control that perturbed a
*shared* value instead would prove only that the kernel is shared, which nobody doubts. The project has been bitten twice by a gate green while enforcing nothing — the
theme-values gate's inherited escape hatch, and feature 006's near-miss where a new lint rule would
have disarmed the one beside it.

The armed gate must still say what it does **not** check: not paint (happy-dom has no compositor),
not published playback (SC-003 is a network claim), and not a host's own registered types. The
placeholder version did this well; the armed one must not do it worse.

## 11 — The preview is the player, unmodified

```bash
pnpm exec vitest run --project @cuestack/studio parity/composition
```

**Expected**: the preview's output carries no editor markup, and nothing under `src/preview/`
re-implements a renderer.

A *composition* claim, not a parity one — and it is what makes §10's comparison the right one to
run. If the preview ever stopped mounting the player, preview-versus-player would become worth
checking and this test would be the thing that noticed.

## 12 — Accessibility

```bash
pnpm exec vitest run --project @cuestack/studio a11y
pnpm exec vitest run --project @cuestack/studio keyboard
```

**Expected**: axe reports zero violations on the preview, its controls, the override indicator, and
the completion state; the **dialog itself has an accessible name**; and every action in User
Stories 1–5 is performable with no pointer events.

The dialog's name is asserted directly rather than left to axe. The suite runs only the WCAG tags,
and `aria-dialog-name` is tagged `best-practice`, so an unnamed modal passes the gate and is
announced to a screen-reader user as "dialog" and nothing else. Widening the tag set for one rule
would be the wrong fix; the tag set is deliberate.

Note that these are two `vitest` invocations rather than `pnpm gates`, and until T062 lands that is
not a shortcut — `gates/a11y.mjs` runs only `packages/react/test/a11y`, so the preview's assertions
are not in the blocking gate. T062 extends it, for the reason this feature creates: the preview is
learner-facing because it *is* the player, and the constitution's gate 6 covers learner-facing
components.

Automated checking is a floor. Feature 004's manual sweep found a progress bar announcing a position
with no subject and no automated check had flagged it.

## 13 — Performance

```bash
pnpm exec vitest run --project @cuestack/studio perf
node tools/scripts/gates/perf.mjs
```

**Expected**: opening a preview at 50 slides / 300 elements stays inside the editor's own
interactive budget (NFR-PERF-001, SC-009). Opening a preview is a **mount**, and it must not cost
more than the editor did.

Since feature 006 the fixture's last slide carries 55 elements, so mount the preview on **that**
slide — a preview of a six-element slide measures nothing, which is the same trap R-09 of that
feature described.

## 14 — The whole suite, and the gates

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm gates && pnpm check:rules && pnpm check:studio-isolation
```

**Expected**: all green, and `gate:parity` no longer says "placeholder".

`check:studio-isolation` is the one to watch here: it proves the player still renders with the
studio package absent from disk. A preview that leaked into `@cuestack/react` would fail exactly
there.

**Recorded when this document was executed verbatim.** 1,964 tests across 243 files; typecheck 9/9;
lint clean apart from the two pre-existing `no-orphans` warnings; five gates green, `gate:parity`
naming five suites and `gate:a11y` naming both packages for the first time; `check:rules` 14 of 18,
unchanged — the four missing rules are all Wave 5, so this feature moves no number there;
`check:studio-isolation`, `check:packaging` (5 packages), `check:isolation`, `check:data-model`, and
`check:migrations` all green.

**One flake, pre-existing and not this feature's.** `test/perf/timeline.test.tsx`'s "playhead to a
rendered state within 90 ms" fails roughly one run in four under load. It is feature 006's budget on
feature 006's fixture, and it passes on a quiet machine. Worth watching rather than worth
suppressing: a budget that only fails under load is a budget close to its limit.

## 15 — The manual pass

Automated checks cannot do these, and they are the ones that find what the others miss.

```bash
pnpm --filter @cuestack/example-nextjs dev
```

Open the editor route and, with a keyboard and a screen reader only:

1. Start a preview from the current position and confirm it begins where the playhead was.
2. Confirm focus lands inside the preview, and returns to the Preview button when you close it.
3. Turn the override on. Confirm the indicator is **findable at any moment**, not a toast that has
   gone by the time you reach the slide you were testing.
4. Reach a gated slide with the override off, then on, and confirm the difference is obvious.
5. Play to the end. Confirm the completion state reads correctly and that the preview waits for you.
6. Switch presets and confirm the slide holds together at each — this is the check the presets exist
   for, and no assertion can make it.
7. Preview a lesson whose slide advances on a click. Confirm you can get past it with the override
   and that nothing suggests the button worked.
8. With reduced motion enabled in your operating system, preview an effect that moves. Confirm the
   reduced substitution plays, and that it does not read as the lesson being broken.

Feature 006 left its equivalent manual pass open, because it needs a human with assistive
technology. This one will too, and saying so is better than marking it done.
