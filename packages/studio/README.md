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
import { EditorCanvas, Inspector, Preview, useEditorSession } from '@cuestack/studio'
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
      <EditorCanvas session={session} resolveAsset={resolveAsset} effects={effects} />
      <Inspector session={session} slide={currentSlide(session)} editors={builtinElementEditors} />
    </>
  )
}
```

## Previewing

`<Preview>` mounts `<LessonPlayer>` over the current draft. It builds no renderer, no clock, and no
effect implementation of its own, so what a teacher sees is what a learner receives — parity by
construction rather than by comparison.

```tsx
const [previewFrom, setPreviewFrom] = useState<PreviewStart | null>(null)

<button onClick={() => { playback.pause(); setPreviewFrom('position') }}>Preview</button>

{previewFrom ? (
  <Preview session={session} from={previewFrom} onClose={() => setPreviewFrom(null)} />
) : null}
```

**Two things a host has to do, and neither happens by itself.**

*Pause first.* The editor's own clock does not stop when a preview opens. Two clocks over one slide
are two answers to what time it is, and the authoring time the preview promises to leave alone would
move while the teacher watched.

*Pass `resolveAsset` to both.* The preview inherits the editor's resolver, so give the same function
to `<EditorCanvas>` — one resolver means the canvas and the preview cannot disagree about what an
asset id points at.

`from` is `'beginning'`, `'slide'`, or `'position'`. The start point is captured **once**, when the
preview opens: a value that cannot change cannot drift, so restart has somewhere fixed to return to
and closing restores nothing because nothing moved.

The preview is a modal `<dialog>`. That is not decoration — Tab does not respect z-index, and every
key handler in this package is element-scoped, so focus is the entire path into an edit. One Tab out
of a merely-covering overlay and one arrow key would nudge an element, invisibly, since the preview
holds the draft as it stood when it opened.

**What it deliberately does not do.** It emits no analytics: the player records `lesson_started` on
mount and a `slide_completed` for every slide it passes, so a preview left wired to a host's
telemetry would report a teacher's checking as a learner's progress. And it writes nothing, ever,
which is why it stays available in read-only mode — reviewing a lesson is reading it.

### The override

One switch, off at every open, that lets every gate through: a required interaction, media that has
not ended, a click no player yet delivers. **One action, not one per gate** — a teacher eight slides
in should not answer eight questions to reach the ninth.

It releases a gate, never a slide's length: turning it on does not skip durations, so a teacher can
still watch what they came to check. While it is on the preview says so continuously, because a
switch that lasts is a switch that gets forgotten, and a teacher who forgets will conclude the
lesson works when what worked was the switch.

### Restart is a fresh run

Restart returns to where the *preview* began — not the lesson's beginning — and it replays into a
lesson whose questions are unanswered and whose gates are armed. That is a remount rather than a
seek, deliberately: the learner's answers live in the player's own interaction state and the advance
controller does not re-decide a slide whose instance has not changed, so a seek would replay a
lesson in which every gate is already satisfied. Half the reason a teacher restarts is "does that
question actually stop it?"

Previous and next are the opposite case and also deliberate: they keep the answers, exactly as a
learner moving within one run would experience.

### Viewport presets

Desktop, tablet, and mobile set the **width** of the preview's own wrapper. They cannot change the
lesson's proportion — the stage's aspect ratio comes from the canvas, and every dimension beneath it
scales with it, so a smaller preview is otherwise the same picture.

What a preset actually reveals is the player's legibility floor. Type is `max(12px, …)`, so below
roughly 600 px on a 16:9 canvas body text stops shrinking and grows relative to the box it was
authored in. The three widths are chosen to straddle that; it is the only thing a preset can show,
and it is the question a teacher opens one to answer. Deliberately *not* device emulation: no touch
simulation, no user-agent spoofing, no chrome. Emulation that is not faithful invites conclusions it
cannot support.

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
