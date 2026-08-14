# Feature Specification: React SSR Player

**Feature Branch**: `003-react-ssr-player`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Continue wave 2"

Wave 2 of `docs/cuestack_framework_plan.md`: `@cuestack/react` turns a computed slide into
something a learner can see, and Next.js serves it from the server. This is the first feature
in the project with a visible result.

## User Scenarios & Testing *(mandatory)*

Waves 0 and 1 served contributors and host developers. This one finally reaches **learners** —
the people who open a lesson and look at it. Their experience is the subject, mediated through
the host developer who embeds the player.

### User Story 1 - A learner sees the lesson before any JavaScript runs (Priority: P1)

A learner opens a lesson on a slow connection or a locked-down device. The first slide — its
text, its images, its layout — is already in the page they received. Nothing is blank while
scripts download, and nothing appears if scripts never arrive at all.

**Why this priority**: It is the wave's reason for existing and the thing no competing tool
does. Every authoring tool in this category is LMS-embedded and auth-gated, so none of them
server-renders; a lesson whose first frame is in the HTML is a genuinely different product. It
is also the only requirement that constrains every other decision in the feature — a renderer
that cannot run without a browser fails here and nowhere else.

**Independent Test**: Fetch the rendered page with JavaScript disabled and assert the first
slide's content and layout are present in the markup. Needs no interaction and no other story.

**Acceptance Scenarios**:

1. **Given** a lesson served from the server, **When** the page is requested with scripts
   disabled, **Then** the first slide's text content is present in the received markup.
2. **Given** the same page, **When** it is inspected before hydration, **Then** each visible
   element is positioned as authored rather than stacked at the origin.
3. **Given** a slide whose first element enters at 500 ms, **When** the server renders it,
   **Then** the state shown is the state at time zero — the element is absent, not
   pre-emptively visible.
4. **Given** the server-rendered page, **When** a search engine or link preview reads it,
   **Then** the lesson's title and first-slide text are discoverable as ordinary text.
5. **Given** a lesson with an unregistered optional element type, **When** the server renders
   it, **Then** the remaining elements still render.
6. **Given** the server rendering path, **When** it is examined, **Then** it reads no viewport
   size, no user preference, and no current time — none of which exist on a server, and any one
   of which would make the rendered output wrong until the browser corrected it.

---

### User Story 2 - Playback takes over without a flicker (Priority: P2)

The learner's browser finishes loading. The lesson begins playing from where the server left
it, with no flash, no jump, and no element repositioning as scripts take control.

**Why this priority**: A visible hydration seam undoes the value of P1 — a learner who sees
the page rearrange itself concludes the product is broken, which is worse than having waited.
It ranks below P1 because P1 is what makes it possible.

**Independent Test**: Render on the server, hydrate in a test environment, and assert the
markup before and after are identical, with no framework hydration warnings emitted.

**Acceptance Scenarios**:

1. **Given** a server-rendered lesson, **When** the browser hydrates it, **Then** the markup
   is unchanged at the moment control transfers.
2. **Given** hydration completes, **When** the console is inspected, **Then** no mismatch
   warning was emitted.
3. **Given** a hydrated lesson, **When** the learner presses play, **Then** elements appear
   and disappear at their authored times.
4. **Given** a lesson playing, **When** the learner pauses, **Then** the visible state holds
   rather than resetting.
5. **Given** a lesson playing, **When** the learner seeks backwards, **Then** the display
   matches that moment without effects appearing to replay.

---

### User Story 3 - The lesson fits the screen without shifting (Priority: P3)

A learner opens the lesson on a phone, a tablet, and a desktop. Each time it fills the
available space at the authored proportions, and it does not resize or jump after loading.

**Why this priority**: Layout shift is the most common way a server-rendered page betrays its
own advantage — content arrives fast and then moves, which is more annoying than arriving
slowly. Ranked below hydration because a shift is a defect in an experience that otherwise
works, whereas a hydration mismatch can break interaction entirely.

**Independent Test**: Render at several viewport widths and assert the authored proportions
hold, and that scaling requires no measurement performed after the first paint.

**Acceptance Scenarios**:

1. **Given** a 16:9 lesson, **When** it is displayed in a narrower container, **Then** it
   scales to fit while keeping its proportions.
2. **Given** the page loads, **When** the layout is compared before and after scripts run,
   **Then** nothing has moved or resized.
3. **Given** a lesson displayed at any size, **When** two elements are 100 logical units
   apart, **Then** they remain proportionally that far apart.
4. **Given** a very small viewport, **When** the lesson renders, **Then** it remains legible
   rather than overflowing its container.
5. **Given** a lesson authored at a different aspect ratio, **When** it renders, **Then** the
   authored ratio is preserved rather than the container's.

---

### User Story 4 - Every kind of content on a slide appears (Priority: P4)

An author has placed text, an image, a shape, a video, an audio clip, a button, and a question
on their slides. All of them appear, positioned and styled as authored.

**Why this priority**: Necessary for a lesson to be worth looking at, but it is breadth rather
than depth — each element type is a small, independent piece of work, and the hard problems
are solved by the three stories above.

**Independent Test**: Render a slide containing every element type and assert each produces
appropriate visible output with its authored geometry.

**Acceptance Scenarios**:

1. **Given** a slide with all seven element types, **When** it renders, **Then** each element
   appears with its authored position, size, and layer order.
2. **Given** a text element, **When** it renders, **Then** its styling comes from the lesson's
   theme rather than from values written into the element renderer.
3. **Given** an image element, **When** it renders, **Then** its alternative text is available
   to assistive technology and space is reserved before the image data arrives.
4. **Given** a video element, **When** it renders, **Then** its captions are available.
5. **Given** an interactive element, **When** the learner navigates by keyboard alone, **Then**
   it can be reached and its purpose is announced.
6. **Given** any rendered element, **When** its appearance is inspected, **Then** no colour,
   font, or spacing value was written into the renderer instead of resolved from the theme.

---

### User Story 5 - A host embeds the player in its own application (Priority: P5)

A developer building on Cuestack drops the player into their own page, supplies a lesson, and
gets a working lesson — without adopting a router, a state library, or a styling system they
did not choose.

**Why this priority**: Determines whether the framework is usable by anyone outside this
repository, but it produces nothing a learner sees, and the earlier stories are what it
packages up.

**Independent Test**: Consume the published package from a minimal host application and render
a lesson, asserting no peer dependency beyond the framework it already uses.

**Acceptance Scenarios**:

1. **Given** a host application, **When** it renders the player with a lesson, **Then** the
   lesson displays with no further configuration.
2. **Given** a host that server-renders, **When** the player is used in a server context,
   **Then** the server-appropriate implementation is selected automatically.
3. **Given** a host that does not server-render, **When** the player is used, **Then** it
   works entirely in the browser.
4. **Given** a host with its own styling conventions, **When** the player renders, **Then** it
   does not impose global styles that leak outside its own boundary.

---

### Edge Cases

- A slide with no visible elements renders an empty stage rather than collapsing to nothing,
  so the lesson's proportions stay stable across slides.
- An element positioned partly or wholly outside the canvas is clipped to the stage rather
  than expanding the page or creating a scrollbar.
- An image or video that fails to load leaves its reserved space and an accessible
  description, rather than collapsing the layout around it.
- A lesson whose theme omits a token a renderer expects falls back to a readable default
  rather than rendering invisibly.
- A learner arriving with a very large system font finds text still contained rather than
  overflowing its element.
- A required interaction type the host has not registered blocks with an explanation, matching
  the kernel's existing behaviour rather than rendering a broken control.
- Two elements at identical layer order render in a stable sequence, so a slide never looks
  different on a second viewing.

## Requirements *(mandatory)*

### Functional Requirements

**Server rendering**

- **FR-001**: The system MUST render a lesson's first slide to markup on the server, with no
  browser present.
- **FR-002**: The server-rendered output MUST represent the lesson's state at time zero, not a
  later or averaged state.
- **FR-003**: Server-rendered content MUST be readable as ordinary text by search engines,
  link previews, and assistive technology.
- **FR-004**: The server path MUST NOT require reading anything unavailable on a server — no
  viewport size, no user preference, no clock.

**Hydration**

- **FR-005**: Markup MUST be identical immediately before and after control transfers to the
  browser.
- **FR-006**: Hydration MUST complete without the framework reporting a mismatch.
- **FR-007**: After hydration, playback MUST resume from the state the server rendered rather
  than restarting.

**Scaling and layout**

- **FR-008**: The lesson MUST fill its container while preserving the authored aspect ratio.
- **FR-009**: Scaling MUST NOT depend on any measurement taken after the first paint.
- **FR-010**: Relative distances and sizes between elements MUST be preserved at every display
  size.
- **FR-011**: Content positioned outside the stage MUST be clipped to it rather than extending
  the page.
- **FR-012**: The rendered lesson MUST NOT cause the page to scroll horizontally at any
  supported viewport size.

**Element rendering**

- **FR-013**: The system MUST render all seven MVP element types with their authored geometry
  and layer order.
- **FR-014**: All colour, typography, and spacing MUST resolve from the lesson's theme; no
  such value may be written into an element renderer.
- **FR-015**: Images MUST expose their alternative text and MUST reserve their space before
  image data arrives.
- **FR-016**: Video MUST expose its captions, and audio-only content its transcript, where the
  author supplied them.
- **FR-017**: Every interactive element MUST be reachable by keyboard and MUST expose an
  accessible name, role, and state.
- **FR-018**: A media or image asset that fails to load MUST leave its reserved space and an
  accessible description in place.
- **FR-019**: A missing theme value MUST fall back to a readable default rather than rendering
  content invisibly.

**Playback control**

- **FR-020**: A learner MUST be able to play, pause, and seek within a lesson.
- **FR-021**: Seeking MUST show the state for that moment without effects appearing to replay.
- **FR-022**: Pausing MUST hold the visible state rather than resetting it.

**Host integration**

- **FR-023**: A host MUST be able to render a lesson by supplying it to the player, with no
  further configuration.
- **FR-024**: The correct server or browser implementation MUST be selected automatically by
  the host's build, without host configuration.
- **FR-025**: The system MUST work in a host that does not server-render at all.
- **FR-026**: The system MUST NOT apply styles outside its own boundary, and MUST NOT require
  the host to adopt a router, a state library, or a styling system.

**Divergence**

- **FR-027**: The visible result MUST be derived solely from the shared computation the
  framework already provides; the renderer MUST NOT compute timing, visibility, or effect
  progress of its own.

### Key Entities

- **Player**: The component a host renders. Accepts a lesson and produces the visible stage.
- **Stage**: The scaled surface a slide's elements are positioned within. Owns the mapping from
  authored coordinates to displayed ones.
- **Element Renderer**: The visual presentation of one element type. Receives a resolved
  element and produces output; performs no timing of its own.
- **Theme Values**: The colours, typography, and spacing a lesson resolves against, supplied to
  renderers rather than embedded in them.
- **Playback Controls**: The learner-facing surface for play, pause, and seek.

## Success Criteria *(mandatory)*

**Reference environment**: durations are measured on the project's standard CI runner
(4 vCPU, 16 GB), consistent with features 001 and 002.

### Measurable Outcomes

- **SC-001**: With scripts disabled, 100% of a lesson's first-slide text content is present in
  the received markup.
- **SC-002**: Hydration produces zero mismatch warnings across every slide in the test corpus.
- **SC-003**: Markup before and after hydration is byte-identical for every corpus slide.
- **SC-004**: Cumulative layout shift attributable to the player is zero — nothing moves or
  resizes after first paint.
- **SC-005**: The authored aspect ratio is preserved at every tested viewport width from 320
  to 2560 pixels, with no horizontal page scrolling at any of them.
- **SC-006**: The first slide is visible within 2 seconds of the lesson data being available,
  excluding media download.
- **SC-007**: All seven MVP element types render, verified by a test that would fail if any one
  produced no output.
- **SC-008**: Zero colour, font, or spacing literals appear in element renderers, enforced
  automatically rather than by review.
- **SC-009**: Every interactive element is reachable by keyboard and carries an accessible
  name, role, and state — 100% of them, with no exceptions carried as known issues.
- **SC-010**: Automated accessibility checks report no violations at WCAG 2.2 Level AA on any
  corpus slide.
- **SC-011**: Seeking to any moment produces the same display as playing to it, for 100% of
  tested moments — the rendered counterpart of the guarantee the framework already proves
  internally.
- **SC-012**: A minimal host application renders a lesson with no dependency beyond the
  framework and the UI library it already used.
- **SC-013**: The server rendering path performs zero reads of viewport size, user preference,
  or current time, enforced automatically rather than by review. This is the constraint a
  well-intentioned change is most likely to break — measuring a container to scale it is the
  obvious way to solve scaling, and doing so silently destroys the server-rendered first frame.

## Assumptions

- **Interactions are not answerable yet.** Question elements render and are keyboard-reachable,
  but submitting an answer, receiving feedback, and gating progression are Wave 3. A required
  interaction still blocks, matching the kernel's existing behaviour.
- **Media is present but not synchronised.** Video and audio elements render with their
  controls and captions; driving playback position from lesson time, and advancing a slide when
  media ends, are Wave 3.
- **Reduced motion is honoured in a later wave.** The kernel already reports which effects are
  motion. This feature must not preclude acting on it — which means motion is expressed in a
  way a stylesheet can override — but substituting reduced alternatives is Wave 3.
- **Transitions between slides are Wave 3.** This feature renders one slide at a time and
  changes slides without a transition.
- **The renderer computes nothing.** All timing, visibility, and effect progress come from the
  existing shared computation. A renderer that derived its own would reintroduce exactly the
  divergence the framework's parity guarantee exists to prevent.
- **React is the adapter for this wave.** Additional adapters are later waves and are not
  designed for here beyond keeping the shared computation free of framework specifics, which it
  already is.
- **Theme values arrive from the lesson.** Organisation-wide theme management is a later
  release; this feature consumes whatever the lesson supplies and falls back readably.

## Dependencies

- **Feature 002** (`specs/002-headless-kernel/`) supplies the computed slide state, the
  playback clock, and the advance decisions. This feature renders them and adds no timing of
  its own.
- **Feature 001** (`specs/001-framework-foundation/`) supplies the lesson format and the export
  conditions this feature's server and browser entries rely on.
- **Constitution** — Principle III becomes fully applicable for the first time: theme tokens,
  keyboard operability, and WCAG 2.2 AA are merge gates from this feature onward. Principle V
  gains its second consumer, making the parity guarantee observable rather than internal.
- **Product specification** `docs/Cuestack_Framework.md` §25.8 (preview and player), §25.3
  (element types), §32.5 (accessibility), and §32.7 (compatibility and responsiveness).
- **Carried forward from feature 002**: the accessibility and hard-coded-theme-value gates are
  present but inert. This feature is where both are armed.

## Out of Scope

- Answering interactions, feedback, and progression gating — Wave 3.
- Media synchronisation, the autoplay gesture requirement, and media-driven slide advancement
  — Wave 3.
- Slide transitions, progress display, and the completion state — Wave 3.
- Reduced-motion substitution — Wave 3, though this feature must leave it possible.
- The editor, its canvas, and its timeline — Wave 4.
- Publishing and immutable versions — Wave 5.
- Adapters for frameworks other than React — Wave 5.
