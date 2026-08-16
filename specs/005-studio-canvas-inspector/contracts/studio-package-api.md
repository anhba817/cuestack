# Contract: `@cuestack/studio` public API

**Feature**: `005-studio-canvas-inspector` · **Package**: `packages/studio`

The fourth published package. Browser-only, client-only, and never a dependency of the player.

## Package shape

```jsonc
{
  "name": "@cuestack/studio",
  "type": "module",
  "sideEffects": ["./dist/styles.css"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "dependencies": {
    "@cuestack/react": "workspace:*",
    "@cuestack/core": "workspace:*",
    "@cuestack/schema": "workspace:*"
  },
  "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }
}
```

**No `react-server` condition, deliberately.** `@cuestack/react` has one because a lesson's first frame
is server-rendered. Authoring is not: there is no server-rendered editor, a teacher is always in a
browser, and every entry point here uses hooks. Shipping an RSC condition would advertise a path that
cannot work and invite a host to try — the mirror of the mistake feature 003 made in the other
direction, where the static player used a hook and could not be a Server Component.

**Zod is expected here.** The editor imports `@cuestack/schema/validate` to satisfy FR-045. That is the
point of the package boundary: the README calls the schema/validate split load-bearing so a learner's
browser never carries a validator, and this package is not in a learner's browser.

## Public surface

```
// The editor, whole
export { StudioEditor } from './StudioEditor.js'
export type { StudioEditorProps } from './StudioEditor.js'

// The pieces, for a host composing its own layout
export { EditorCanvas } from './canvas/EditorCanvas.js'
export { Inspector } from './inspector/Inspector.js'
export { useEditorSession } from './session/useEditorSession.js'
export type { EditorSession, EditorMode } from './session/useEditorSession.js'

// The draft reducer — pure, usable with no React
export { applyEdit } from './draft/reducer.js'
export type { Edit, EditResult, EditContext, EditRefusal } from './draft/edit.js'
export type { IdSource } from './draft/ids.js'

// Geometry — pure, usable with no DOM
export { moveBy, resizeBy, rotateBy } from './geometry/transform.js'
export { snap } from './geometry/snap.js'
export { align, distribute } from './geometry/align.js'
export {
  SNAP_THRESHOLD_UNITS, NUDGE_UNITS, NUDGE_UNITS_COARSE,
} from './geometry/constants.js'
export type { Geometry, SnapCandidate, SnapResult } from './geometry/types.js'

// Editor-side registration — the fifth plugin member
export { createElementEditorRegistry, builtinElementEditors } from './registry/editors.js'
export type { ElementEditor, ElementDefaults, TextSurface } from './registry/editors.js'
```

`StudioEditorProps`:

| Prop | Type | Notes |
|---|---|---|
| `manifest` | `LessonManifest` | The starting draft. |
| `slideId` | `string` | Which slide to edit. |
| `mode?` | `'edit' \| 'read-only'` | Defaults to `'edit'`. The host maps roles to this (FR-051). |
| `onChange?` | `(draft: LessonManifest) => void` | Every accepted edit. The host's hook for persistence, which this feature does not do. |
| `idSource?` | `IdSource` | Defaults to `crypto.randomUUID()`. Tests inject (FR-050). |
| `editors?` | `ElementEditorRegistry` | Defaults to the built-in seven. |
| `theme?` | `ThemeValues` | Passed through to `Stage`, as the player does. |
| `analytics?` | `AnalyticsAdapter` | For FR-048's insertion events. No PII by construction — `LessonEvent` has no field one could occupy. |

## What is deliberately absent

- **No storage.** No `save`, no `load`, no dirty flag. `onChange` hands the host every draft and stops
  there; `StorageAdapter` exists from Wave 1 and ED-5 wires it.
- **No undo/redo.** Deletion is confirmed instead (FR-033). `applyEdit` is the seam ED-5 wraps.
- **No preview.** Rendering a slide at an authoring time is not previewing from a start point; ED-6
  owns that, and it is what arms the parity gate.
- **No slide navigator.** One slide at a time, addressed by `slideId`.
- **No roles.** `mode` is the entire authorisation surface (FR-051).

## Boundary enforcement

Three mechanisms, in increasing strength:

1. **Dependency-cruiser** gains `no-studio-in-player`: nothing under `packages/{react,core,schema}/src`
   may reach `@cuestack/studio`. The existing `no-core-in-schema` and `no-adapters-in-core` rules add
   `studio` to their target lists so the arrow keeps pointing one way.
2. **`check-packaging`** covers the new package automatically — it enumerates `packages/*` — so publint
   and `attw` run against the exports map above.
3. **`check-studio-isolation.mjs`** is the real proof, and it works by absence: pack `@cuestack/react`,
   `@cuestack/core`, and `@cuestack/schema`, install them into an empty directory with studio nowhere
   on disk, and render a lesson. A player that renders when the editor does not exist cannot be
   shipping it (FR-049, SC-015). This mirrors `check-core-isolation.mjs`, whose header makes the same
   argument for the UI-framework boundary.

## Workspace wiring this package requires

| File | Change |
|---|---|
| `vitest.config.ts` | **Two** projects. `@cuestack/studio` with `environment: 'happy-dom'`, mirroring the react project. `@cuestack/studio-pure` in the `node` environment, claiming `test/{geometry,draft}` wholesale plus any file named `*.pure.test.ts` anywhere under `test/` — happy-dom computes no layout, so a suite that must not depend on one is given an environment where it cannot (research R-04). The filename marker exists because purity is a property of a module rather than a directory: `session/` holds both a React hook that needs a DOM and the selection algebra that must not. Add `packages/studio/src/**` to coverage `include` — reported, no numeric floor, per Constitution II's rule for UI packages. |
| `eslint.config.js` | The workspace ban on `dangerouslySetInnerHTML` across `packages/**` (FR-046, NFR-SEC-007). A lock rather than a sanitizer: research R-11 verified the prop appears nowhere today and every renderer escapes text as a React child, so the requirement holds by construction and what needs guarding is the next renderer, not the current ones. |
| `.dependency-cruiser.cjs` | `no-studio-in-player`; `studio` added to existing target lists; a rule confining DOM-geometry reads to `canvas/pointer.ts` (research R-04). |
| `tools/scripts/gates/theme-values.mjs` | Extend to scan `packages/studio` — otherwise the armed gate passes by not looking. |
| `tools/scripts/gates/perf.mjs` | Editor budgets: interaction 100 ms, authoring-time change 100 ms, interactive-at-50/300 3 s. |
| `.github/workflows/ci.yml` | `pnpm check:studio-isolation` in the packaging job. |
| `package.json` | `check:studio-isolation` script. |

The acceptance job's name does **not** change. It stays "A, B, C, F" — scenario D needs save recovery,
which needs persistence, which is ED-5.
