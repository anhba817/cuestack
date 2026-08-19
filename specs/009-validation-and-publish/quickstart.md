# Quickstart: Validation and Immutable Publish

How to run this feature and check that each of its five stories holds. Every command runs from the
repository root.

Design detail lives in [data-model.md](./data-model.md),
[contracts/validation-contract.md](./contracts/validation-contract.md), and
[contracts/publishing-contract.md](./contracts/publishing-contract.md). This is the run guide.

---

## 1. Prerequisites

```bash
pnpm install
pnpm build          # required: the gates and the studio suites read dist/, not src/
```

`pnpm build` matters as much here as it did for feature 008. `@cuestack/studio` resolves core through
its package entry, so a change to the validation engine is invisible to a studio test until core is
rebuilt — and `@cuestack/react` carries a freshness guard that will tell you so.

## 2. Run everything

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm gates
pnpm check:rules    # 18 of 18 after this feature, up from 14
```

`check:rules` is the headline number. BR-008, BR-009, BR-012, and BR-018 gain rule-named tests here,
and it is the first time every business rule in the specification has one.

## 3. Run only this feature's suites

```bash
pnpm test --project @cuestack/core   test/validation    # the engine — no DOM at all
pnpm test --project @cuestack/core   test/elements      # the seven plugins, and the registry cliff
pnpm test --project @cuestack/core   test/interactions  # the dead-end predicate, beside isUnsatisfiable
pnpm test --project @cuestack/core   test/publishing    # the fourth adapter's contract
pnpm test --project @cuestack/core   test/rules         # BR-008, BR-009, BR-012, BR-018
pnpm test --project @cuestack/studio test/validation    # the report surface and jump-to-source
pnpm test --project @cuestack/studio test/publishing    # the publish flow and its refusals
```

Most of this feature is testable with no DOM, which is a consequence of the engine being pure rather
than a preference about test style. If a suite here starts needing happy-dom, something has moved to
the wrong side of the line.

---

## 4. US1 — the report

```bash
pnpm test --project @cuestack/core test/validation
```

What to look for:

- `composition.test.ts` is the one to read first. It proves the engine *delegates*: a lesson with a
  broken advance rule produces the same code `checkReachability` produces, and a structurally invalid
  lesson produces the schema's own codes. The engine is not allowed a second opinion.
- `no-type-branch.test.ts` registers a plugin for an invented element type and asserts its issues
  appear. If the engine ever grows a `switch (element.type)`, a type it has never heard of stops
  being validated and this fails.
- `deterministic.test.ts` validates one lesson twice and compares the arrays, not sets. Order is part
  of the contract because a teacher who re-runs a report should not have to find their place again.
- `interactions/dead-end.pure.test.ts` covers the rule this feature adds — and note where it lives:
  beside `isUnsatisfiable` in `interactions/`, not in `validation/`, because the two are one rule
  asked at two moments and separating them is how they come to disagree (research R-02). It covers: `on_correct` with a finite `maxAttempts` is
  reported; `on_first_attempt` is not; unlimited attempts are not.
- `resilience.test.ts` registers a plugin whose `validate` throws and asserts every *other* issue is
  still reported. An author with one broken plugin still needs the rest.

**Prove it can fail.** Remove the `ElementPlugin.validate` call from the engine and re-run:
`no-type-branch.test.ts` fails while everything else passes.

## 5. US2 — errors block, warnings do not

```bash
pnpm test --project @cuestack/studio test/publishing/blocks.test.tsx
```

Read `refusals.test.tsx` alongside it. There are four ways a publish does not happen — validation
errors, an unresolvable asset, a permission refusal, and a save that could not land — and every one
of them asserts the same two things: nothing was published, and the draft is byte-identical. SC-012
is that assertion across all four.

The message assertions matter more than they look. A teacher told "could not publish" about a network
failure goes looking through their lesson for a problem that is not there.

## 6. US3 — what was published stays published

```bash
pnpm test --project @cuestack/core   test/rules/BR-008.test.ts
pnpm test --project @cuestack/core   test/rules/BR-009.test.ts
pnpm test --project @cuestack/studio test/publishing/immutable.test.tsx
```

`immutable.test.tsx` publishes, then edits the draft heavily — adds, deletes, undoes, restores a
version — and compares the published manifest byte for byte. `BR-008` attacks it directly: it takes
the object `loadPublished` returned and tries to mutate it, at the top level and deep inside a
slide's elements, and asserts both throw.

The structural half cannot be tested by running anything, so it is asserted by inspection in
`contracts/publishing-contract.md` §3 and by the type: there is no method that modifies a version.

## 7. US4 — publishing again

```bash
pnpm test --project @cuestack/core test/publishing/versions.test.ts
```

Publish three times; assert three versions, exactly one active, the newest active, and the first two
unchanged. The last assertion is the one that catches an adapter that stores one version and
overwrites it.

## 8. US5 — withdrawal and the record

```bash
pnpm test --project @cuestack/core test/publishing/withdraw.test.ts
pnpm test --project @cuestack/core test/publishing/record.test.ts
```

`withdraw.test.ts` asserts the three-way answer: active, withdrawn, and not found are three different
results. A host that cannot tell the last two apart tells a learner a lesson does not exist about a
lesson that plainly does.

`record.test.ts` asserts append-only by trying: it takes the array `readRecord` returned and attempts
to push, splice, and reassign an entry.

## 9. Performance

```bash
pnpm test --project @cuestack/core test/perf/validation.test.ts
```

SC-005: the 50-slide, 300-element fixture validated within one second. The asset pass is deliberately
outside this budget — it is network-bound and optional, and including it would measure the host.

## 10. Try it by hand

```bash
pnpm --filter @cuestack/nextjs-example dev
# http://localhost:3000/edit
```

The example wires the in-memory publishing adapter, so everything works with no backend. Three things
are worth doing by hand because no assertion conveys them:

1. Put a required question with one attempt on a slide and validate. The dead end should be reported
   before you ever play it.
2. Publish, then delete every slide, then look at the published version. It should still play.
3. Withdraw, and confirm the player says the lesson is withdrawn rather than missing.

## 11. Manual keyboard and screen-reader pass

Automated checks catch attributes; they do not catch whether a sequence makes sense. With a screen
reader running:

1. Reach the validation report and move through it by keyboard alone.
2. Confirm each issue announces its severity as a word, not only as a colour or an icon.
3. Jump from an issue to its source and confirm focus lands somewhere sensible.
4. Confirm a report with no issues announces that plainly rather than reading as an empty region.
5. Publish with errors present and confirm the refusal is announced, not only rendered.
6. Reach the publish, withdraw, and restore controls and operate each from the keyboard.
7. Confirm a permission refusal is announced and says permission is what is missing.
8. Move through the published-version list and confirm each entry names its publisher and time.

Record the result in the pull request. This is the Definition of Done item the constitution names,
and it is open on features 006, 007, and 008 for the same reason: it needs a person.

## 12. Known issues in the surrounding suite

- `packages/studio/test/perf/timeline.test.tsx` — "playhead to a rendered state within 90 ms" fails
  roughly one run in four under load. **Pre-existing**, recorded during feature 007 and unchanged by
  this work. Re-run before investigating.
- Two `no-orphans` warnings from `lint:boundaries` predate this feature.

## 13. What is deliberately not here

- **Fixing anything.** The engine reports; it never edits. An offered repair is a separate idea, and
  feature 006's "extend to fit" shows how one would be built.
- **Blocking a save.** Only publication is gated. A draft may be as broken as an author needs while
  they work.
- **An approval workflow.** Review and sign-off are a first-follow-up-release item in spec §19.
- **A player URL.** The framework ships no server. It provides the stable identifier a host puts
  behind one (FR-027).
