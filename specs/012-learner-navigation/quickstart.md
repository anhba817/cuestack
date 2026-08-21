# Quickstart: proving a learner can move through a lesson

Each scenario is a command and what it should say. Where a scenario can pass for the wrong
reason, that is called out — several here can.

---

## 0. The kernel can be asked without being changed

```bash
pnpm vitest run --project '@cuestack/core' test/advance/may-leave
```

A pure predicate over `(slide, signals)`: would anything refuse a learner who asked to leave right
now? False for an unanswered required question on every mode, false for the gated modes, true for
`on_click` and for a timed slide before its duration elapses.

**The assertion that matters is that calling it changes nothing.** The obvious way to answer this
question is `advance.evaluate(...)` — and `evaluate` records that a slide decided, so a speculative
call consumes the decision and the slide never advances. Call the predicate, then call `evaluate`,
and the slide must still decide.

---

## 1. A button advances the lesson

```bash
pnpm vitest run --project '@cuestack/react' test/playback/navigation
```

Press a `next_slide` button; the next slide shows. By pointer and by keyboard, since a native
`<button>` gives Enter and Space for free and a styled `<div>` would have to earn them back.

**Passes vacuously if** the fixture is a single slide. Every fixture in feature 011's element
harness was single-slide, and that hid a missing feature for the whole feature.

---

## 2. A waiting slide waits, then leaves

```bash
pnpm vitest run --project '@cuestack/react' test/playback/on-click
```

A slide with `advance: { mode: 'on_click' }` does **not** move when its authored duration
elapses, and does move when the learner asks.

**Both halves matter.** A test that only presses the button passes against an implementation
that advances on duration too — which would be the feature working and the lesson broken.

---

## 3. Replay does not strand the learner

```bash
pnpm vitest run --project '@cuestack/react' test/playback/replay
```

Press Replay, watch the slide restart, then reach its end again and continue.

**This is the one to run first.** Implemented as `transport.restart()` the slide restarts
perfectly and then never advances again, because the visit counter did not move and the advance
controller still holds the slide as decided. The first assertion passes; the lesson is broken.

---

## 3a. A button does not carry a learner past a gate

```bash
pnpm vitest run --project '@cuestack/react' test/playback/gate-not-bypassed
pnpm vitest run --project '@cuestack/element' test/gate-not-bypassed
```

A slide declaring `advance: { mode: 'after_interaction' }` carrying a `next_slide` button: the
control is unavailable, a press moves nothing, and the slide advances by its own rule once
answered.

**Run this before believing any of the rest.** The format permits that combination, and an
unconditional "the button performs its action" defeats the gate the slide exists to declare —
a working button that skips a required question is worse than the inert one this feature
replaces. The design nearly shipped without this row.

**Passes for the wrong reason if** it only checks availability *before* the question is answered.
A first version of this rule keyed availability on gate state, and that state lasts one frame:
the slide leaves as soon as the interaction completes. Assert unavailability after answering too,
or the test passes against a rule that briefly offers a control which does nothing.

```bash
pnpm vitest run --project '@cuestack/react' test/playback/br-005
```

**The case three versions of this rule would have shipped broken.** A slide advancing
`after_duration`, carrying a required question and a Continue button: the control is unavailable
and a press moves nothing. BR-005 says a required interaction outranks automatic advancement on
*every* mode, and the direct-command path is the one place the kernel is not consulted.

`check:rules` will still report 18 of 18 if this is wrong — BR-005's own test exercises the
controller, which stays correct. The bypass lives in the adapter, so only this test sees it.

```bash
pnpm vitest run --project '@cuestack/studio' test/preview/override
```

And with the editor's advance override on, the control still reports itself unavailable — the
override moves the lesson, not the control.

---

## 4. Validation refuses a slide nobody can leave

```bash
pnpm vitest run --project '@cuestack/core' test/advance/unsatisfiable
```

Three cases, and the third is the point:

- waits for the learner, has a `next_slide` button → nothing reported;
- waits for the learner, has no button → reported;
- waits for the learner, has only a Back button → **reported**, with a different message.

And one warning, not an error:

- declares a gate and carries a `next_slide` button → warned that the control can never be
  operated there. **Assert the severity.** An error would refuse a lesson that is perfectly
  publishable, since the slide is satisfiable through its gate.

**The existing test must split rather than relax.** It currently asserts that `after_duration`
and `on_click` "cannot be unsatisfiable". Widening that to accept the new behaviour is a
one-character edit that also stops it catching anything. `after_duration` keeps a test saying it
cannot be unsatisfiable; `on_click` gets cases in both directions.

---

## 5. Publishing refuses it too

```bash
pnpm vitest run --project '@cuestack/studio' test/publishing
```

A lesson containing such a slide cannot be published, the same as any other dead end.

---

## 6. Focus lands on the new slide

```bash
pnpm vitest run --project '@cuestack/react' test/playback/focus
pnpm vitest run --project '@cuestack/element' test/focus
```

Press Continue; focus is on the incoming stage rather than on `document.body`.

**Two traps.** Focus must not move on first render — that takes focus from the host's page. And
in the web component the target is inside a shadow root, so an assertion must read the root's
`activeElement`; `document.activeElement` reports the host and would pass while proving nothing.

---

## 7. A control that cannot move says so

```bash
pnpm vitest run --project '@cuestack/react' test/elements/button
```

Back on the first slide and Continue on the last carry `aria-disabled` and do nothing when
pressed. `disabled` would remove them from the tab order, so a learner using a screen reader
would never reach them to hear why.

---

## 8. The renderer still cannot reach the lesson

```bash
pnpm vitest run --project '@cuestack/react' test/elements/renderer-boundary
```

Structural, over the source: renderer props carry no transport, no lesson, no slide, no time.

**The check that matters most and looks like a formality.** Three implementations of this feature
break the boundary and all three work — props, `usePlayer()`, or a bubbling DOM event. None fails
any other test.

---

## 9. Both adapters do it, and agree

```bash
pnpm vitest run --project '@cuestack/element' test/api
pnpm check:agreement
```

The web component renders buttons too, and the agreement report covers navigation. `button`
leaves the declined set; `video`, `audio`, and `question` stay, each for its own reason.

`covered.test.ts` fails until the partition is updated, which is the right way round: the covered
set is stated in four places and a change that updates three should not pass.

---

## 10. Preview behaves like playback

```bash
pnpm vitest run --project '@cuestack/studio' test/preview
```

Same renderer, so a working button works there. What it must not do is give preview a second way
to change slides that the timeline does not follow.

---

## 11. Everything still holds

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates
pnpm check:rules && pnpm check:docs && pnpm check:agreement
```

`check:rules` must still read 18 of 18. `pnpm test:coverage` is a known red at 89.03% branches
against a 90% floor — pre-existing, recorded in the framework plan, and not this feature's to
fix; it must not get worse.
