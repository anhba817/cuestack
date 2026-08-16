# @cuestack/studio

The authoring surface: a canvas a teacher arranges a slide on, and an inspector that describes
what they arranged.

Browser only, client only. There is no server entry and no `react-server` condition — authoring
is not server-rendered, every surface here uses hooks, and advertising an RSC path that cannot
work would only invite a host to try.

## Why this is a separate package

`@cuestack/react` is what a learner downloads, on every lesson view. This package is the largest
piece of UI the project will ever write, and none of it is any use to a learner.

The boundary is enforced three ways, in increasing strength:

1. `no-studio-in-player` in `.dependency-cruiser.cjs` — nothing under `packages/{react,core,schema}`
   may reach this package.
2. `check-packaging` runs publint and `attw` against the exports map.
3. `check-studio-isolation.mjs` proves it by **absence**: it packs the player and its
   dependencies, installs them into an empty directory with this package nowhere on disk, and
   renders a lesson. A player that renders when the editor does not exist cannot be shipping it.

There is a second consequence worth knowing. The editor validates the draft after every edit, so
it depends on `@cuestack/schema/validate` and therefore on Zod. The README at the repository root
calls the schema/validate split load-bearing precisely so a learner's browser never carries a
validator — and this package is not in a learner's browser.

## Usage

```tsx
import { EditorCanvas, Inspector, useEditorSession } from '@cuestack/studio'
import '@cuestack/react/styles.css'
import '@cuestack/studio/styles.css'

function Studio({ lesson }: { lesson: LessonManifest }) {
  const session = useEditorSession({
    manifest: lesson,
    slideId: lesson.slides[0]!.id,
    onChange: (draft) => save(draft),   // persistence is yours; see below
  })

  return (
    <>
      <EditorCanvas session={session} />
      <Inspector session={session} slide={currentSlide(session)} editors={builtinElementEditors} />
    </>
  )
}
```

## Read-only

`mode: 'read-only'` renders and inspects without editing. Every mutating action is refused at the
reducer — one check at the single point every change passes through, rather than an audit of
every button — and the interface shows its controls disabled with a reason.

Which users get that mode is the host's decision. **This framework models no roles.** It ships the
one thing a reviewer actually needs from it, and leaves authentication and authorisation where
they belong.

Copying is permitted in read-only and pasting is not. Copying changes no authored data, so
refusing it would be a restriction nothing asked for.

## What this package deliberately does not do

- **Persist anything.** Edits change an in-memory draft and `onChange` hands you each one.
  `StorageAdapter` exists in `@cuestack/core` and is not wired here; autosave, the offline queue,
  and conflict handling are ED-5's.
- **Undo.** Deletion is confirmed instead — the lower of the two bars Constitution III accepts,
  and recorded as temporary. When real undo arrives the confirmation should be *removed*, not kept
  alongside: a tool that both confirms and undoes every deletion has stopped trusting its history.
- **Preview.** Rendering a slide at an authoring time is not previewing from a start point. That
  is ED-6, and it is what finally arms the parity gate.
- **Show a timeline.** One authoring-time control, no tracks. ED-3 replaces it and must set the
  same value rather than introduce a second time model.
- **Edit a slide's advance mode.** BR-005 and BR-006 give it cross-field rules and an element
  picker; both belong with the timeline work.
- **Browse assets.** An asset field takes an identifier. The library is later.

## Design notes worth knowing before changing anything

**The canvas renders through the player.** `EditorCanvas` mounts `Stage` and `SlideView` from
`@cuestack/react` with exactly the props the player passes, and calls `resolve(slide, timeMs)`
with the same two arguments. Editor affordances live in an overlay *beside* that layer, never
inside it — the parity suite asserts the render layer is byte-identical with the overlay removed.

**The kernel is untouched.** Elements the resolver leaves out — hidden, or outside their time
window — are drawn by the overlay as selectable ghosts, computed from a diff. The resolver never
learns that an editor exists.

**Geometry is pure and runs with no DOM.** `getBoundingClientRect()` returns zero under happy-dom,
so drag logic that derived geometry from a measured rect would be untestable. The transform and
snap engines take logical units; a single module, `canvas/pointer.ts`, converts screen deltas at
the input edge and is the only place in the package permitted to measure anything.

**Everything a teacher does is one `Edit`.** `applyEdit` is pure, never mutates its input,
validates its result, refuses everything in read-only, and skips locked elements rather than
failing whole selections. It is also the seam undo will wrap.
