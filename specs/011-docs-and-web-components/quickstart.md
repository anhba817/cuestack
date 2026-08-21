# Quickstart: proving the guide and the second adapter work

Runnable checks in the order they become possible. Each says what to run and what it must show.

**Prerequisites**: `pnpm install`, then `pnpm build`.

---

## 1. The element exists and plays

```bash
pnpm vitest run packages/element/test/plays.test.ts
```

Create `<cuestack-lesson>`, **set `autoplay`**, give it a manifest, advance the injected clock, and
assert the shadow root holds the elements the first slide should show. Nothing waits on wall-clock
time — Constitution II forbids that, and the transport takes its clock as a port precisely so it
never has to.

The `autoplay` step is easy to leave out of a description and impossible to leave out of a working
integration: the element does not start itself, so without it a lesson renders its first frame and
holds. The harness sets it, exactly as the React suite's `play()` helper passes `autoPlay: true`.

---

## 1a. Slides advance, and transitions run

```bash
pnpm vitest run --project '@cuestack/element' test/transitions.test.ts
```

Seven assertions: the second slide arrives when the first slide's duration elapses, the first is
gone once the transition ends, both halves are marked while it runs, the authored type and duration
reach CSS, it ends on lesson time rather than wall-clock, the leaving half is hidden from a screen
reader, and no transition runs when none is authored.

**Run this one against a single-slide fixture and it passes vacuously** — which is exactly how these
went unimplemented. Every fixture in the harness was one slide, so nothing ever crossed a boundary
and nothing failed.

---

## 2. No UI framework, asserted rather than reviewed

```bash
pnpm lint                                   # dependency-cruiser boundary rules
node -e "import('@cuestack/element')"       # loads with react absent
```

SC-007. Two rules matter here and one is easy to miss: nothing may depend on this package, **and this
package must not depend on `@cuestack/react`** — which is the specific mistake research R-01 makes
tempting, because eight modules it wants are in there and React is only a peer dependency, so nothing
would visibly break.

---

## 3. What is absent is visible

```bash
pnpm vitest run packages/element/test/unavailable.test.ts
```

SC-006, and with a proof-scoped adapter this is the **ordinary** path — four of seven types take it.

- A `video`, `audio`, `button`, or `question` element occupies its geometry and says it cannot be
  shown, the way the React player reports an unknown type.
- An `image` with no `resolveAsset` supplied does the same, rather than rendering a broken picture.
- **A slide waiting on a question this adapter cannot render reports that it cannot advance**, so a
  learner is told rather than stranded. `resolve` already returns `blockingUnknownRequired`; this
  asserts the adapter surfaces it.

---

## 4. The two adapters agree about what they both cover

```bash
pnpm check:agreement
```

SC-005. Resolves one manifest through both adapters at matched instants and prints what differs —
slide, element, property, and the two values.

**It exits zero whatever it finds** (FR-011), and it deliberately does **not** live in
`tools/scripts/gates/` — `run-all.mjs` runs everything there and fails on a non-zero exit, so a
reporter among gates works today and invites the next reader to "fix" it into one. Two adapters are two renderers by design over one
kernel; a difference is information, not a failure. The report names which types were **covered**,
because a report that omitted that would read as "the adapters agree" when it means "the adapters
agree about text and shapes".

---

## 4a. The stylesheet resolves from tokens

```bash
pnpm vitest run packages/element/test/tokens.test.ts
pnpm gates                                   # theme-values must now reach this package
```

Constitution III. The test reads the emitted stylesheet **as a string** and requires every colour,
font, and spacing value to resolve from `var(--cs-…)`.

A test rather than only a lint rule, because the rule's selector is `Literal[value=/^#…/]` and a colour
inside a template literal is a `TemplateElement` — verified by running ESLint against a probe with a
hex in backticks, which passed clean. The stylesheet is a template literal, so the selector alone would
have been protection that reached nothing.

---

## 5. Two lessons on one page do not touch each other

```bash
pnpm vitest run packages/element/test/instances.test.ts
```

SC-010. Two elements, two manifests, two clocks advanced independently — neither affects the other's
slide, timing, or styles. Then the one that gets forgotten: **disconnect cancels the frame loop.** A
loop that outlives its element makes a page slower the longer somebody uses it, and nobody traces that
back to a lesson they closed.

---

## 6. A learner can use it

```bash
pnpm vitest run packages/element/test/a11y.test.ts
pnpm gates                                   # and the gate must now know about it
```

SC-009. The same bar the React player is held to, measured the same way: no WCAG violations on the
learner-facing surface, reduced motion honoured, and nothing essential conveyed by colour alone —
including the unavailable notice, which is the thing most likely to be rendered as a grey box and
nothing else.

---

## 5a. It imports on a server without a DOM

```bash
pnpm check:element-isolation
```

Packs the tarball, installs it into a bare directory, and imports it in a node process — no
framework, no `customElements`, no `HTMLElement`. Expect three packages installed and none of them a
UI framework.

**This is the only check that can find the SSR crash.** `class extends HTMLElement` is evaluated at
module load, so a bare declaration throws on import in any server process; every suite in the
package runs in happy-dom, where `HTMLElement` exists. The package renders nothing on a server — it
cannot — but it must *import* there, or a host's shared module graph fails to build.

---

## 6a. The kernel is shared, not copied

```bash
pnpm vitest run packages/element/test/one-kernel.test.ts
```

FR-009, and the feature's central claim. `packages/element/src` imports `resolve`, `createClock`, and
`createTransport` from core and defines none of them; no file under it declares a second clamp, a
second effect implementation, or its own resolution pass.

This is also the plan's stop condition — *if the adapter needs its own resolve or its own clock, stop
and report rather than fork* — and a stop condition nothing can trigger is a sentence.

---

## 7. The guide's example is real

```bash
pnpm vitest run packages/core/test/fixtures/guide-example
```

SC-013. The type the guide teaches is registered and exercised. It supplies the **whole** contract —
an example omitting a member would teach an author to write something `createElementRegistry` refuses.

---

## 8. The guide cannot rot

```bash
node tools/scripts/check-doc-snippets.mjs
```

FR-006a. Every fenced block in the guide names a source file and region; the script extracts and
compares. A mismatch fails.

The reason this is mechanical: `ElementEditor`'s header has explained that "the seven built-in types
have no `ElementPlugin`" since before feature 009 made it false, through two subsequent releases. The
audience for a guide is the people who cannot tell it is wrong.

---

## 9. A developer can actually follow it

Not automatable, and the only check that measures what US1 promises:

1. Give the guide to somebody who has not worked on this codebase.
2. Ask them to add an element type.
3. Record every question the guide did not answer.

SC-001 is that they succeed with **no change to any existing package**. The list from step 3 is the
more useful output.

---

## 10. The documentation says what the framework is

```bash
# by inspection
cat docs/packages.md
```

SC-011. A reader names the package they need for a stated goal. The three questions it must answer
without being asked: does this ship a backend, does it run a server, must I use its editor.

---

## 11. Nothing that was true stopped being true

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && \
  pnpm gates && pnpm check:rules && pnpm check:packaging && pnpm check:isolation && \
  pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations
```

`check:rules` must still read **18 of 18**; this feature adds no business rule.

**`pnpm test:coverage` is a known red**, at 89.03% branches against a 90% floor, pre-existing and
recorded in the framework plan. It is not this feature's to fix and must not get worse.

---

## 12. The findings are written down

By inspection of `docs/cuestack_framework_plan.md`:

- The ten React-free modules in `@cuestack/react`, and the extraction they want. (Recorded as eight
  during Phase 0; re-measured during implementation and corrected.)
- That the kernel cannot report an adapter's own limits, and that FR-010's slide playback and
  transitions were missing from the plan and the task list while sitting in the contract all along.
- Anything else the adapter turned up about the kernel, **including what was not acted on**.
- Every documentation claim corrected, and what made it false.

SC-012. This is the deliverable that is easiest to skip and the one the feature exists for: a second
adapter that reported nothing would be the surprising outcome, not the good one.
