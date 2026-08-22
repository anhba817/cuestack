# Research: A frame rate nobody has ever seen

Seven findings. Two settle the tooling, three shape the measurement, and two are traps the obvious
implementation walks into.

---

## R-01: Playwright, because WebKit

**Decision.** Playwright as the browser runner.

FR-011a requires the behaviour paths to be checked on all three major engines. That requirement
exists because autoplay policy, media event ordering and container-query layout are where engines
genuinely differ — and `domMediaPort.ts`, the module with 0% branch coverage, is squarely in the
first of those.

Puppeteer drives Chromium and Firefox. It does not drive WebKit. So the engine most likely to differ
on media policy would be the one engine not checked, which inverts the reason for checking three.

**Alternatives considered.** Selenium/WebDriver drives all three but through a heavier, older API
with no bundled browsers. Puppeteer is lighter and would be sufficient if FR-011a were dropped;
dropping it was considered during clarification and rejected on the grounds above.

---

## R-02: Frame timing comes from `requestAnimationFrame`, not from a trace

**Decision.** Collect frame deltas in-page with `requestAnimationFrame` and compute the two
statistics from the array.

Chromium's tracing (`Performance.getMetrics`, DevTools traces, `long-animation-frame`) gives richer
data, and it is Chromium-only. FR-001 measures on one engine, so a Chromium-only method is
*available* — but the collection code lives in the harness alongside the behaviour suite, which runs
everywhere. Two collection paths for one number is the shape that goes stale.

`requestAnimationFrame` deltas are what the compositor actually delivered to the page. They are
coarser than a trace and they measure the right thing: whether a frame arrived on time.

**What this cannot see.** Frames the compositor never scheduled because the tab was throttled, and
work on other threads. Recorded here so the contract can state it rather than a reader inferring it.

---

## R-03: The throttled baseline is necessarily Chromium

**Decision.** State it rather than discover it.

CPU throttling is `Emulation.setCPUThrottlingRate`, a Chrome DevTools Protocol capability. Firefox
and WebKit expose no equivalent through Playwright. So the ~4x baseline run can only happen on
Chromium.

That is consistent with FR-001 measuring on a single engine, and it would be an unpleasant surprise
if it were found during implementation instead. It also bounds the claim: the baseline figure is a
Chromium estimate of a school laptop, not a cross-engine one.

---

## R-04: Two harnesses, because the two adapters are consumed differently

**Decision.** One per adapter — and each loaded the way that adapter actually reaches a host.

**The first version of this finding had the inventory wrong**, and the wrong inventory was doing the
justifying. It said container-query units live in `packages/element/src/styles.ts`. Measured:

| File | `cqw` / container uses |
|---|---|
| `packages/element/src/styles.ts` | 5 |
| **`packages/react/src/player/Stage.tsx`** | **1** |
| `packages/studio/src/preview/constants.ts` | 2 |
| `packages/studio/src/preview/ViewportPreset.tsx` | 1 |

**The primary player uses them too.** So canvas-relative layout is not an element-adapter concern
that happens to need a browser; it is a *player* concern that both adapters implement and neither
has ever had checked. A layout assertion written only against the element page would test the
adapter that is not the main one — which is the same error as the inventory that produced it: a
design decision resting on an incomplete look.

The split survives, on a better reason:

| What | Where it lives | Which harness |
|---|---|---|
| Per-frame playback work, media adapter, `Stage.tsx` layout | `@cuestack/react` | the example app |
| `styles.ts` layout, reduced-motion (2 blocks) | `@cuestack/element` | a static page |

Reduced motion is genuinely element-only — `packages/element/src/styles.ts` holds both
`prefers-reduced-motion` blocks and nothing has ever evaluated them, because happy-dom resolves no
media queries over style.

---

## R-05: The subjects are already available

**Decision.** No new fixture.

`heavyLesson()` is exported from `tools/scripts/fixtures/heavy-lesson.mjs` — 50 slides, 300 elements,
the shape every existing budget uses. The tour lesson is `examples/nextjs/app/tour.ts`, and the
example app already builds in CI under Gate 12.

Using the same heavy fixture as the gate is what makes the browser figure comparable to the proxy
figure. **The gap between them is what paint costs**, and that number has never existed.

---

## R-06: The failure modes are silence, and there are three of them

**Decision.** Each fails loudly, and each gets a control.

| Failure | What it looks like without care |
|---|---|
| A browser engine is not installed | the run skips that engine and reports the other two as a pass |
| The harness serves but the lesson never starts | the check waits for frames that never come, and hangs |
| Media cannot autoplay | the same hang, from a different cause |

The third is not hypothetical: browsers block audible autoplay without a user gesture, deliberately.
The behaviour suite must assert both paths — muted media that may autoplay, and the blocked path
that must be handled rather than waited on — with a bounded timeout so a hang becomes a failure.

This repository has now found four gates whose package lists reached nothing. A browser check that
skips an engine is the same defect wearing a different coat.

---

## R-07: The exemption and the evidence are one change

**Decision.** `domMediaPort.ts` leaves the coverage report **in the same commit** that gives it a
browser exercising it.

The module reports 21.27% of statements and 0% of branches, and no test references it directly — the
coverage it has comes from being imported. Its sibling `browserPorts.ts` is already excluded, with
the reason in the config: *"Exercised by the example app and by any host, and coverable here only by
asserting that happy-dom's `document` behaves like a browser's — which would test happy-dom."*

That argument applies verbatim here. But it is an argument about **where the evidence lives**, and
the exemption is a one-line change with no dependencies — the easiest thing in this feature to do
first, and the only one that makes the situation worse if it lands alone. A visible zero at least
tells the truth. An exemption naming evidence that does not yet exist does not.

---

## R-08: A browser cannot load `dist`, and the fix is different per adapter

**Decision.** The React harness is the example app; the element harness is a static page with an
import map. **No bundler is added.**

The first draft said "load built `dist`, because that is what a host gets". Checked against the
tree, a browser cannot load it at all — both dists import bare specifiers, and
`<script type="module">` resolves none of them:

```text
packages/react/dist/index.js   -> "@cuestack/core", "react", "react/jsx-runtime"
packages/element/dist/index.js -> "@cuestack/core", "@cuestack/schema/validate"
```

**The justification was also inaccurate.** What a host gets is `dist` *through a bundler* — and the
thing in this repository that already does that is `examples/nextjs`, which carries the tour lesson
and is built far more often than it first appears. `examples/*` is a workspace member with a build
script, so **`pnpm build` compiles the Next app** — 7 packages build, that one among them. It is not
merely Gate 12's business; it is built by every contributor's `pnpm build`, by CI's first gate before
typecheck ever runs, and by this feature's own quickstart prerequisite. So the React harness is that app, with one route added that mounts
the heavy fixture. That is not a workaround; it is the most faithful harness available, because it
is the consumption path a host actually uses.

**The element adapter is the opposite case, and an import map is equally faithful.** A web component
exists to be usable *without* a bundler, so loading it by import map is how it is meant to be
consumed. The chain is closed and small — four workspace entries plus one third-party:

```text
@cuestack/element        -> /packages/element/dist/index.js
@cuestack/core           -> /packages/core/dist/index.js
@cuestack/schema/validate-> /packages/schema/dist/validate/index.js
@cuestack/schema/migrate -> /packages/schema/dist/migrate/index.js
zod                      -> resolved at serve time, never written down
```

**The last entry is the one with a trap in it.** Under pnpm, zod resolves from schema's context to
`node_modules/.pnpm/zod@4.4.3/node_modules/zod/index.js` — a path carrying a version number that
changes on every upgrade. It is proper ESM (`"type": "module"`, with an `import` condition), so the
map entry works; it just cannot be a literal. `serve.mjs` resolves it from `@cuestack/schema`'s
context and serves whatever comes back. This is the same root cause as `vite` not being resolvable
at the workspace root: pnpm's strict layout means a path that works is not a path you may write.

**Alternatives considered.** Adding a bundler for both pages would be uniform and costs a second
build dependency alongside Playwright — and `vite` is *not* resolvable at the workspace root today
(it is transitive under vitest, pnpm-isolated), so "just use vite" is a declaration, not a
convenience. An import map for React was rejected because React's own ESM layout in `node_modules`
is the fragile part, and the example app already solves it.

**This also resolves the tour lesson.** `examples/nextjs/app/tour.ts` is TypeScript with a
type-only import — loadable in principle, but not by a static page. Inside the example app it is
already compiled.

---

## R-09: The app already imports fixtures, and has since it was written

**Decision.** Commit the heavy lesson as JSON inside the example app, import it statically, and
assert it still matches `heavyLesson()`.

R-08 moved the React harness into the example app and did not answer how the fixture gets there.
The first answer generated a file into `public/` and had the route fetch it. **That was invented
without looking at the app**, which does this on line 2 of its own front page:

```ts
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }
```

A static JSON import. It has been the mechanism all along.

**What the generate-and-fetch version silently took on**, all three of which vanish here:

- `examples/nextjs/public/` does not exist and would have to be created;
- nothing gitignores it — `git check-ignore` returns no rule;
- `app/page.tsx` is a **server component**, so a same-origin fetch at prerender time has no server
  to answer it. The route would have needed `'use client'` and an effect, or `force-dynamic`.

A static import also means the app **keeps building unconditionally**, so the "render a notice when
the file is absent" requirement disappears rather than needing to be met.

**And that matters more than "Gate 12 stays green" suggested.** `examples/*` is in the workspace, so
`pnpm build` builds the Next app: a broken route here does not fail one CI job, it fails every build
— contributors', CI's first gate, and this feature's own sweep. The static import is what makes that
safe, because there is nothing left to be absent.

**The route mirrors the shape the app already uses**: a server component that imports the lesson and
hands it to a client component that plays it — exactly `app/page.tsx` handing off to
`app/tour-view.tsx`. Frame collection needs the client half; the import needs the server half.

### The trap in committing a generated artifact, and the answer

An 86KB JSON checked in beside a function that produces it is two sources of truth, and it will
drift: `heavyLesson()` changes, the committed file does not, and the browser check quietly measures
a different lesson than `pnpm gates` does. **That is the defect this repository keeps finding**, so
it gets the treatment this repository keeps applying: the relation is checked rather than trusted.
One assertion that the committed file equals `JSON.stringify(heavyLesson())` — the same shape as
`core-freshness.test.ts`, `check-data-model` and `check-agreement`.

**That assertion rests on the generator being deterministic, which was checked rather than assumed.**
`heavy-lesson.mjs` contains no `Math.random`, `Date.now`, `new Date`, `performance.now`,
`process.env` or `crypto`, and two calls produce byte-identical output — 87,944 bytes. Recorded here
so that if variability is ever introduced, the reason this check existed is on record rather than
rediscovered when it starts flaking.

**Committed in the app, not in a package.** `packages/schema` has `"files": ["dist", "fixtures"]`
and is not private, so putting it there would ship 86KB to every consumer of the schema package for
the benefit of one private demo. `examples/nextjs` is private and unpublished; the fixture belongs
with the harness that reads it. For scale: the reference fixture is 7KB.
