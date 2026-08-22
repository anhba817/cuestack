# Cuestack

A timed lesson authoring and playback framework. Headless core, React-first, with
server rendering under Next.js.

A *cue stack* is the stage manager's ordered list of timed triggers for running a show.
That is what a Cuestack lesson is: slides whose elements enter, emphasise, and exit on a
clock, and which advance on a duration, a click, a media end, or a learner's answer.

## Status

**Wave 0 — Framework Foundation.** The lesson format contract and the workspace that
publishes it. No renderer, no editor, nothing to look at yet. See
[`docs/cuestack_framework_plan.md`](docs/cuestack_framework_plan.md) for what comes next.

## Setup

Requires **Node 22.12+** (CI runs Node 24 LTS) and **pnpm 11**.

```bash
corepack enable
git clone <repo> && cd cuestack
pnpm install
pnpm build
```

That is the whole setup. No global TypeScript, no editor plugin, no environment
variables. If a step beyond these is ever needed, that is a defect against SC-001.

```bash
pnpm test          # behaviour: 379 test files, ~10 s
pnpm gates         # performance budgets, accessibility, parity, theme values
pnpm test:gates    # proof each gate goes red when it should
pnpm typecheck     # strict, zero errors expected
pnpm lint          # per-file rules + architectural boundaries
```

**`pnpm test` does not measure performance, deliberately.** A timing taken while a dozen suites
compete for the same cores measures the competition: the same commit used to pass or fail at
random, six times in ten under load. Every budget is owned by `pnpm gates`, which runs each
package's performance suite on its own and prints what it measured against what it was allowed.
Budgets are stated against the reference CI runner; a local timing is indicative.

### Build timing

SC-001 budgets clone-to-build at **under 10 minutes**, measured on the reference
environment — the project's standard CI runner (4 vCPU, 16 GB) — and excluding
`pnpm install` download time, which depends on network conditions the project does not
control. A local timing is indicative, not authoritative.

| Measurement | Budget | Recorded |
|---|---|---|
| `pnpm install` (excluded from budget) | — | ~8 s warm store |
| `pnpm build`, cold cache, 5 workspace projects | < 10 min | **5.5 s** |
| `pnpm test` (379 test files) | — | **~10 s** |
| `pnpm gates` (24 measured budgets, 5 packages) | — | ~10 s |

Measured on a developer machine, not the reference runner — CI records the authoritative
number. The budget has three orders of magnitude of headroom, so the interesting question is
not whether it passes but when it starts to move.

## Packages

| Package | What it is |
|---|---|
| `@cuestack/schema` | The lesson format: types, validators, migrations |
| `@cuestack/core` | Headless kernel — clock, resolver, registries, validation, publishing, packaging |
| `@cuestack/react` | React adapter, server-renderable. **The complete player** |
| `@cuestack/studio` | The authoring editor — canvas, timeline, inspector. Optional |
| `@cuestack/adapter-http` | Save, load, publish and list over your own API |
| `@cuestack/element` | `<cuestack-lesson>`, a framework-free adapter. **Deliberately partial** |

**[docs/packages.md](docs/packages.md) says which of these you need for a stated goal**, and answers
the three questions people ask first: no, this ships no backend; no, playback needs no server; no,
the editor is not required.

To add an element type of your own, see
**[docs/authoring-elements.md](docs/authoring-elements.md)** — one plugin, one renderer, and no
change to any package here.

`@cuestack/schema` has two entry points and the split is load-bearing:

```ts
import type { LessonManifest } from '@cuestack/schema'      // zero runtime bytes
import { validate } from '@cuestack/schema/validate'        // pulls in Zod
```

A learner's browser receives a manifest that was validated at author time. Shipping a
validation library to the player would tax every lesson load for a check that already
happened, so validation lives behind its own specifier and the player never imports it.

## Governance

[`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds the
non-negotiables — test-first on the timing rules, the core/UI boundary, performance as a
contract, preview-player parity. CI enforces them; a green build is necessary, not
sufficient.

Requirements live in [`docs/Cuestack_Framework.md`](docs/Cuestack_Framework.md).
