---
'@cuestack/react': minor
'@cuestack/core': minor
---

`@cuestack/react`: the server-rendered, hydrating lesson player.

A host renders a lesson by supplying it. The first slide arrives in the HTML
document — real content, discoverable by a search engine and readable with
JavaScript disabled — and then hydrates into playback without moving.

- **Two entry points behind one name.** `react-server` resolves a hook-free
  static player; the default resolves the playing one. A Server Component and a
  browser get the component each can actually use.
- **Scaling in CSS, not JavaScript.** Every visual value reaches the page as a
  CSS custom property and every dimension in container query units, so geometry
  is correct without measuring anything. That is what lets a server emit a
  layout for a viewport it cannot know, and why there is no layout shift when
  scripts run.
- **All seven element types**, each with its accessibility obligation: alt text
  and reserved dimensions on images, caption tracks on video, transcripts on
  audio, real buttons, and questions as labelled radio groups. WCAG 2.2 AA is a
  merge gate from this release onward.
- **Playback controls**, keyboard-operable, with targets that do not shrink with
  the stage.
- **`@cuestack/react/styles.css`** — one stylesheet, entirely scoped beneath the
  player's stage, so a host's own styles are untouched.
- Reduced motion is already honoured, in CSS, on the server-rendered first frame.

`@cuestack/core`: `ResolvedElement` now carries the element's authored
accessibility metadata, passed through untouched. A renderer receives only a
`ResolvedElement`, so without it an image's alternative text was in the manifest
and unreachable by the one component that needs it. Additive.

**Known limits.** Questions render but cannot be answered. Media renders with
native controls and is not synchronised to lesson time. Navigation buttons carry
their action but do not act. There are no slide transitions. Asset ids are
resolved by a host-supplied function; there is no publishing pipeline yet.
