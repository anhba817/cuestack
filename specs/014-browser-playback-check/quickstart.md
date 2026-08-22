# Quickstart: proving the frame rate exists

Each scenario is a command and what it should say. Two of them can pass for the wrong reason, and
those are called out.

**Prerequisite for all of them**: `pnpm build --force`, then `pnpm --filter @cuestack/example-nextjs
build`. Both harnesses read built output, and a cached build leaves `dist` older than `src`, which is
a red board this project already documents.

**Two harnesses, because the adapters are consumed differently** (research R-08). The React harness
is a route in the example app, which already bundles — a browser cannot load `packages/react/dist`
directly, since it imports `@cuestack/core`, `react` and `react/jsx-runtime` as bare specifiers. The
element harness is a static page with a five-entry import map, which is how a web component is meant
to be used. `pnpm check:browser` starts what each needs.

**The React route imports its subject** (research R-09). `tools/scripts/fixtures/` is in neither the
example app's dependency graph nor its tree, so the heavy lesson is committed as
`examples/nextjs/app/heavy-lesson.json` and imported statically — the way the app has read fixtures
since it was written (`app/page.tsx` line 2). No server, no `public/`, no fetch, and the app keeps
building unconditionally — which matters more than "Gate 12 stays green": `examples/*` is a workspace
member, so **`pnpm build` compiles this route**, and a mistake in it breaks every build rather than
one CI job.

**A committed artifact beside the function that produces it is two sources of truth**, so the
relation is checked rather than trusted:

```bash
pnpm exec vitest run --project gates tools/scripts/__tests__/browser-check
```

The committed JSON must equal `JSON.stringify(heavyLesson())`. Break it on purpose — edit one slide
and confirm the check fails. Without it, `heavyLesson()` changes, the file does not, and the browser
check quietly measures a different lesson than `pnpm gates` does.

---

## 1. The engines are actually there

```bash
pnpm exec playwright install --with-deps
pnpm exec playwright --version
```

**Can pass for the wrong reason.** A missing engine must fail the run, not reduce it: three engines
reporting a pass and a fourth silently absent is the shape of the four gates this repository has
shipped with lists that reached nothing. Break it on purpose — remove one engine and confirm the
behaviour suite fails naming it, rather than reporting two greens.

---

## 2. A lesson plays, and frames are counted

```bash
pnpm check:browser
```

Two figures, each carrying its conditions:

```text
CI reference       chromium  heavy fixture (50 slides/300 elements)  unthrottled
  median frame     X.XX ms / 16.7 ms
  frames > 33.3ms  N of M
Baseline reference chromium  tour lesson  4x CPU (school laptop, approx.)
  median frame     X.XX ms / 16.7 ms
  frames > 33.3ms  N of M
```

**The gap between the CI figure and the existing gate's proxy figure is what paint costs.** That
number has never existed. Both run the same heavy fixture precisely so the subtraction is valid.

---

## 3. The browser-only paths are exercised

```bash
pnpm check:browser --behaviour
```

On **all three** engines:

- the real media adapter — a muted video that may autoplay, and a blocked one that must be handled
  rather than waited on;
- canvas-relative layout at two viewport widths, **on both adapters**, with elements landing
  proportionally where the author placed them. Container units sit in four files across three
  packages and one of them is `packages/react/src/player/Stage.tsx` — the primary player — so
  checking only the element page would check the adapter that is not the main one. happy-dom never
  evaluates `cqw`, so none of it has been checked by anything;
- reduced motion honoured, which Constitution III requires and nothing has ever checked.

Where engines legitimately differ — autoplay policy most of all — the difference is asserted. A
check demanding identical behaviour from three engines encodes a specification nobody wrote.

---

## 4. It says what it does not cover

```bash
pnpm check:browser 2>&1 | tail -20
```

Not real hardware; not a cross-engine frame claim; not frames the compositor never scheduled. The
gate's existing disclaimer is the precedent and the reason: a green line gets read as a full answer
unless it says otherwise.

---

## 5. The variance is known before any number is enforced

```bash
pnpm check:browser --repeat 10
```

Ten runs, and the spread of both statistics recorded here. **This is the prerequisite for writing
down any threshold at all** (FR-007). Feature 013 spent itself removing a timing threshold set
without knowing its spread; frame timing is noisier than what it removed.

**Nothing here gates yet.** If ten runs show a spread wider than the margin a threshold would need,
that is the finding, and it is more useful than a threshold.

---

## 6. The media adapter is exercised and excused, in that order

```bash
pnpm test:coverage 2>&1 | grep -E 'media|All files'
```

`domMediaPort.ts` no longer appears, and the exclusion in `vitest.config.ts` names the browser check
as what exercises it instead.

**Can pass for the wrong reason, and this is the one to watch.** The exemption is a one-line change
with no dependencies — the easiest step in the feature and the only one that makes things worse
alone. Confirm scenario 3 covers the module *before* reading this as done: a visible zero tells the
truth, and an exemption naming evidence that does not exist does not.

---

## 6a. CI reports without blocking, and says why

```bash
grep -A4 'Every job here is blocking' .github/workflows/ci.yml
```

The comment must name this job as the exception and name FR-007's variance run as what retires it.
**A silent `continue-on-error` in a file that opens by forbidding them** is how an invariant stops
being one — and the invariant is right: *"a gate that tolerates failure is documentation, not a
gate."*

---

## 7. Nothing else got slower

```bash
time pnpm test
time pnpm gates
```

~10 s and ~10.2 s, unchanged. The browser check is a fourth runner and joins neither. If `pnpm gates`
has grown, the browser work has leaked into a signal people run before pushing, which is what
FR-006 exists to prevent.

---

## 8. Everything still holds

```bash
pnpm build --force && pnpm typecheck && pnpm lint && pnpm test && pnpm test:gates && pnpm gates
pnpm check:rules && pnpm check:docs && pnpm check:agreement && pnpm check:isolation
pnpm check:element-isolation && pnpm check:packaging
```

`check:rules` must still read 18 of 18. The isolation and packaging checks matter more than usual
here: Playwright is the first browser dependency this repository has taken, and all three of those
checks exist because a dependency once leaked into a package that should not have had it.


---

## Recorded results (T013, T016)

**Both references, Chromium, 5-second windows, on this machine:**

| Reference | Subject | Throttle | Median frame | Frames > floor |
|---|---|---|---|---|
| CI | heavy fixture | none | 16.70 ms / 16.67 target | 0 of 492 |
| Baseline | tour lesson | 4x CPU | 16.70 ms / 16.67 target | 2 of 308 |

**Variance over ten runs each (FR-007):**

| Reference | Median spread | Floor-breach spread |
|---|---|---|
| CI | 16.70–16.70 ms | **0–0** |
| Baseline | 16.70–16.70 ms | **2–3** |

### What these numbers say, and what they do not

**The floor-breach count works. The median does not.** `requestAnimationFrame` deltas measure frame
*pacing*, and pacing is pinned to the display refresh interval whenever nothing is dropped — so the
median reads 16.70 ms at 1x and at 4x, on a busy page and an idle one, with zero spread across ten
runs. It cannot discriminate, and comparing it to the 60 fps target is comparing a constant to a
constant.

The floor-breach count is the statistic that carries information: 0 unthrottled, 2–3 at 4x, stable
enough across ten runs that a bound could be argued for. **Arming one is still a separate act**
(FR-012), and the evidence FR-007 asked for now exists to argue it with.

**FR-001 mapped the wrong statistic to the target**, and only building it showed that. A target
expressed as *work per frame* rather than *interval between frames* is what would discriminate —
which is, notably, exactly what the existing proxy in `pnpm gates` already measures. The honest
reading is that the browser check answers the **floor** and the proxy answers the **target**, and
neither replaces the other.
