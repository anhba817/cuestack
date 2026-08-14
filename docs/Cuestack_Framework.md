# Cuestack — Timed Lesson Framework

**Document version:** 0.1  
**Status:** Product-definition draft  
**Intended audience:** Product managers, UX designers, software architects, developers, and QA engineers  
**Product name:** Cuestack (the framework and its engine); Cuestack Studio (the authoring application)  
**Document scope:** Product Vision, Personas, Journey Map, and Software Requirements Specification

---

## 1. Executive Summary

Cuestack is a web-based lesson-authoring framework that enables teachers to create slide-based, multimedia lessons with timed content, chronological visual effects, interactions, and automatic slide progression.

The authoring experience should feel as approachable as a presentation tool while adding capabilities specifically designed for teaching:

- Slide-by-slide lesson construction
- Text, images, video, audio, shapes, and interactive questions
- Automatic or learner-controlled slide progression
- Timed entrance, emphasis, and exit effects
- A simple sequencing mode for ordinary teachers
- An advanced timeline for precise timing
- Immediate preview of the learner experience
- Versioned publishing
- A shared rendering engine between the editor and the learner player

Teachers create all instructional content themselves. AI-assisted lesson generation is explicitly outside the current product scope.

The defining product principle is:

> **Simple enough for a teacher creating a lesson between classes, but precise enough for an instructional designer building a carefully paced learning experience.**

---

# Part I — Product Vision

## 2. Product Vision Statement

### Vision

Enable every teacher to create engaging, paced, multimedia learning experiences as easily as creating presentation slides—without requiring animation, video-editing, or programming expertise.

### Product mission

Cuestack will provide teachers with an intuitive visual workspace for combining content, timing, effects, media, and interactions into lessons that play consistently across devices.

### Product promise

A teacher should be able to:

1. Create a lesson.
2. Add and organize slides.
3. place content visually on each slide.
4. Control when each element appears.
5. Choose how each slide advances.
6. Add learner interactions.
7. Preview the exact learner experience.
8. Publish the lesson without technical assistance.

---

## 3. Problem Statement

Teachers commonly use presentation tools to create visual lessons, but presentation tools are not designed around learner progression, required interactions, completion tracking, or web-based delivery.

Traditional LMS lesson builders often support educational structures but provide limited visual composition, weak animation controls, and static page-based content.

Professional animation and video-editing tools offer precise sequencing but are too complex and time-consuming for most teachers.

This creates a gap:

- Presentation tools are visually flexible but not learning-aware.
- LMS builders are learning-aware but often visually restrictive.
- Animation tools are powerful but inaccessible to ordinary teachers.
- Video is easy to consume but difficult to update, localize, or make interactive.

Cuestack addresses this gap by combining:

- Presentation-style slide authoring
- Education-specific interactions
- Timeline-based sequencing
- Controlled lesson progression
- Web-native publishing and playback

---

## 4. Target Users

Cuestack primarily serves:

- Classroom teachers
- Corporate trainers
- Instructional designers
- Subject-matter experts
- Curriculum developers
- Training program administrators

The resulting lessons are consumed by:

- Students
- Employees
- Course participants
- Self-directed learners

---

## 5. Core Value Proposition

### For teachers

Create polished, interactive, timed lessons without needing animation or development skills.

### For instructional designers

Control the order, timing, pacing, and behavior of lesson elements while using a reusable structured format.

### For organizations

Publish consistent, versioned, accessible learning experiences through a standard framework rather than relying on static presentation files or videos.

### For learners

Receive clear, paced, multimedia lessons that guide attention and require participation at appropriate moments.

---

## 6. Product Differentiators

Cuestack should differentiate itself through the following capabilities.

### 6.1 Learning-aware slide progression

Slides can advance:

- After a defined duration
- When the learner clicks Next
- When a selected video or audio element ends
- When a required interaction is completed

### 6.2 Simple sequencing and advanced timing

Teachers can choose between:

- **Simple Sequence Mode:** “With previous,” “After previous,” and “After delay”
- **Timeline Mode:** Precise element-level start times, end times, and effect durations

Both modes operate on the same underlying timeline data.

### 6.3 Shared preview and playback engine

The teacher preview and learner experience use the same rendering and timing engine.

This supports a true:

> **What you preview is what the learner receives.**

### 6.4 Structured, editable lessons

Unlike video, published lessons remain structured. Text, timing, interactions, and individual assets can be edited without recreating the entire experience.

### 6.5 Extensible framework

Element types, question types, effects, themes, and publishing adapters can be extended through a versioned plugin architecture.

---

## 7. Product Principles

### 7.1 Simple first, precision on demand

Teachers should not need to open the timeline to build an ordinary lesson. Advanced controls should be available without overwhelming new users.

### 7.2 Teaching flow over production complexity

The product should prioritize instructional pacing and comprehension rather than cinematic animation features.

### 7.3 One source of truth

The lesson JSON model is the source of truth for editing, previewing, publishing, and playback.

### 7.4 Deterministic playback

The same lesson version should produce the same sequence and timing across supported browsers, subject to normal media-loading tolerances.

### 7.5 Safe authoring

Autosave, undo, version history, validation, and draft isolation should reduce the risk of losing work or accidentally changing a published lesson.

### 7.6 Accessibility by default

Teachers should receive support for captions, alt text, keyboard navigation, readable contrast, and reduced-motion behavior.

### 7.7 Reusable rather than proprietary

The framework should support exportable, versioned lesson packages rather than storing lessons in an opaque editor-only format.

---

## 8. Product Goals

### Goal 1: Reduce lesson creation effort

A teacher should be able to create and publish a basic five-slide timed lesson in less than 20 minutes after initial onboarding.

### Goal 2: Make timing understandable

A teacher should be able to create a chronological sequence without understanding professional animation terminology.

### Goal 3: Preserve preview and player parity

Published lessons should behave consistently with the teacher preview.

### Goal 4: Support educational interactions

Teachers should be able to pause progression until a learner completes a required question or activity.

### Goal 5: Support long-term framework growth

New element and effect types should be addable without rewriting the core canvas, timeline, or player architecture.

---

## 9. Suggested Product Success Metrics

### Activation

- Percentage of new teachers who create at least three slides
- Percentage of new teachers who successfully preview a lesson
- Percentage of new teachers who publish a lesson within seven days

### Efficiency

- Median time to create a five-slide lesson
- Median number of actions required to add and sequence an element
- Percentage of lessons created without support intervention

### Feature adoption

- Percentage of lessons using automatic slide advancement
- Percentage of lessons using at least one timed effect
- Percentage of lessons containing an interaction
- Usage split between Simple Sequence Mode and Timeline Mode

### Quality

- Publish failure rate
- Playback error rate
- Autosave recovery rate
- Preview-to-player consistency incidents
- Accessibility warning resolution rate

### User satisfaction

- Teacher satisfaction score after publishing
- System Usability Scale score
- Percentage of teachers who create a second lesson
- Learner completion rate for published lessons

### Initial target outcomes

- At least 70% of first-time teachers successfully preview a lesson without assistance
- Median creation time below 20 minutes for a basic five-slide lesson
- Publish success rate above 99%
- No confirmed loss of acknowledged autosaved work
- Preview and learner-player timing difference below 100 milliseconds for non-streaming elements under normal conditions

---

## 10. Product Non-Goals

The initial product is not intended to be:

- A full learning management system
- A professional video editor
- A replacement for After Effects
- A fully featured presentation suite
- An AI content-generation system
- A live virtual classroom
- An adaptive learning engine
- A student information system
- A course marketplace
- A real-time multiplayer design environment
- A full SCORM or xAPI authoring suite in the first release

---

# Part II — Personas

## 11. Persona 1: The Time-Constrained Teacher

### Role

Classroom teacher, tutor, or trainer who creates lessons regularly while managing many other responsibilities.

### Technical confidence

Moderate. Comfortable with presentation software and common web applications, but not with timelines, keyframes, or code.

### Context

This teacher may create or update a lesson shortly before teaching it. They need to work quickly and cannot spend hours learning a complicated authoring system.

### Jobs to be done

- Turn an existing lesson plan into visual slides
- Explain concepts in a controlled sequence
- Add images and videos
- Ask learners questions during the lesson
- Reuse or modify previous lessons
- Publish content quickly

### Goals

- Create a professional-looking lesson rapidly
- Keep learners focused on one idea at a time
- Avoid manually clicking through every content reveal
- Confirm exactly what learners will see
- Make updates without rebuilding the entire lesson

### Pain points

- Complex animation interfaces
- Too many settings shown at once
- Losing work after a browser or network problem
- Inconsistent formatting
- Videos that do not play correctly
- Uncertainty about whether the published lesson matches the preview
- Difficulty coordinating slide duration with animations

### Required product capabilities

- Simple Sequence Mode
- Familiar slide thumbnails
- Drag-and-drop editing
- Reusable layouts and templates
- Automatic timing suggestions
- Clear warnings instead of technical errors
- Autosave
- One-click preview
- Easy duplicate and reuse actions

### Representative statement

> “I need to make the lesson clear and engaging, but I do not want to become an animation expert.”

### Success definition

The teacher creates, previews, and publishes a functional lesson without consulting technical documentation.

---

## 12. Persona 2: The Instructional Designer

### Role

Instructional designer, curriculum developer, or experienced digital-learning author.

### Technical confidence

High. Comfortable with authoring tools, media, learning objectives, question design, and detailed sequencing.

### Context

This user creates structured learning experiences for many teachers, courses, or business units. They care about consistency, accessibility, reusability, and precise learner behavior.

### Jobs to be done

- Design carefully paced learning sequences
- Coordinate narration, media, text, and visual effects
- Create required interactions
- Build reusable lesson templates
- Standardize branding and behavior
- Review and update published content
- Test lessons across device sizes

### Goals

- Obtain precise timing control
- Reuse components and themes
- Ensure predictable playback
- Create versioned, reviewable content
- Apply organization-wide standards
- Extend the framework with new content types

### Pain points

- Simplified tools that do not allow precision
- Authoring and playback engines behaving differently
- Inability to inspect exact timing
- Lack of keyboard shortcuts
- Weak versioning and change history
- Proprietary formats that cannot be migrated
- Poor accessibility controls

### Required product capabilities

- Advanced Timeline Mode
- Millisecond-based timing
- Copy and paste between lessons
- Alignment and distribution tools
- Layer controls
- Reusable templates
- Version history
- Schema export
- Accessibility validation
- Theme and plugin extension points

### Representative statement

> “I need control, consistency, and a format that remains maintainable after the first publication.”

### Success definition

The instructional designer can build complex, timed lessons without leaving the product or compromising organizational standards.

---

## 13. Persona 3: The Reviewer or Program Lead

### Role

Department lead, curriculum manager, training manager, compliance reviewer, or school administrator.

### Technical confidence

Low to moderate.

### Context

This person may not create every lesson, but is accountable for quality, correctness, branding, accessibility, and release approval.

### Jobs to be done

- Review a lesson before publication
- Check content and pacing
- Confirm required information is included
- Request changes
- Approve a version
- View who changed and published the lesson
- Ensure a published lesson remains stable

### Goals

- Review without accidentally editing
- Leave clear comments
- Compare versions
- Confirm the final published state
- Trace changes and approvals
- Prevent incomplete or inaccessible content from being released

### Pain points

- Receiving screenshots rather than a playable preview
- Unclear version ownership
- Changes being made after approval
- No audit trail
- Reviewing content outside the actual learner experience
- Published content changing unexpectedly

### Required product capabilities

- Reviewer permissions
- Preview-only mode
- Comments
- Review status
- Version comparison
- Publish validation report
- Audit history
- Immutable published versions

### Representative statement

> “I need to know that the lesson I approved is the same lesson learners received.”

### Success definition

The reviewer can inspect, comment on, approve, and verify a lesson version without needing authoring expertise.

---

## 14. Persona 4: The Learner

### Role

Student, employee, or participant consuming the published lesson.

### Technical confidence

Varies widely.

### Context

The learner may use a desktop computer, tablet, or mobile device. They may have limited time, attention, bandwidth, or accessibility accommodations.

### Jobs to be done

- Start the lesson easily
- Follow the content at an understandable pace
- Pause or replay when permitted
- Answer required questions
- Receive feedback
- Complete the lesson
- Resume after an interruption when supported

### Goals

- Understand what to do next
- Read and watch content without layout problems
- Avoid missing information because of unexpected timing
- Use keyboard or assistive technology where required
- Know progress and completion status

### Pain points

- Slides advancing before content is understood
- Small text on mobile devices
- Motion that is distracting or uncomfortable
- Videos playing without captions
- Controls that disappear or are difficult to use
- Losing progress after closing the browser
- Interactions that are inaccessible

### Required product capabilities

- Clear playback controls
- Responsive scaling
- Pause and replay behavior
- Progress indication
- Keyboard navigation
- Captions and transcripts
- Reduced-motion support
- Accessible interactions
- Resume behavior where enabled

### Representative statement

> “Show me what matters, give me enough time, and make the next action obvious.”

### Success definition

The learner can complete the lesson without confusion, inaccessible controls, or unexpected content loss.

---

# Part III — Teacher Journey Map

## 15. Journey Overview

The primary journey follows a teacher from creating a lesson through publishing and later revision.

The intended emotional progression is:

**Uncertain → Oriented → Productive → In control → Confident → Accomplished**

---

## 16. Journey Map

| Stage | Teacher goal and actions | Likely thoughts | Main pain points | Product response | Success signal |
|---|---|---|---|---|---|
| 1. Start a lesson | Create a blank lesson or begin from a template; enter title and basic settings | “Where do I begin?” | Empty-canvas anxiety; too many initial settings | Provide a clear blank/template choice, sensible defaults, and a short guided start | First slide created within two minutes |
| 2. Organize slides | Add, duplicate, name, delete, and reorder slides | “I want to map out the lesson before designing everything.” | Losing orientation in a long lesson; accidental deletion | Use familiar thumbnails, undo, clear duration badges, and optional slide groups | Teacher creates the intended lesson structure |
| 3. Add content | Add text, images, shapes, video, audio, and questions | “This should feel like a presentation tool.” | Inconsistent sizing; difficult alignment; unclear media upload state | Drag-and-drop canvas, snapping guides, inline text editing, asset status, reusable styles | Teacher creates a readable slide without documentation |
| 4. Define pacing | Set slide duration and decide whether progression is automatic or learner-controlled | “How long should this slide remain visible?” | Duration shorter than media or effect sequence; unclear interaction between settings | Show a duration ruler, calculated minimum duration, and clear advance-mode controls | Every slide has a valid progression rule |
| 5. Sequence effects | Make elements appear, emphasize, and disappear chronologically | “I want the title first, then the image, then the explanation.” | Timeline terminology; overlapping effects; too many controls | Offer Simple Sequence Mode first and Timeline Mode on demand | Teacher creates a valid sequence and understands the preview |
| 6. Add interactions | Add a question and determine whether it blocks progression | “The learner must answer before continuing.” | Unclear correct-answer setup; auto advance occurring too early | Provide question templates, required/optional settings, answer feedback, and explicit gating | Interaction behaves correctly in preview |
| 7. Preview and test | Play from the current slide, current time, or beginning; test different device sizes | “Will learners see exactly this?” | Preview behaving differently from published playback; time-consuming restart | Use the shared player engine, quick seek controls, and device presets | Teacher completes preview without playback errors |
| 8. Validate and publish | Resolve issues, publish a version, and obtain a shareable or embeddable result | “Is anything missing?” | Vague validation errors; accidental changes to live content | Present actionable validation, immutable published versions, and visible status | Lesson publishes successfully and live version is identifiable |
| 9. Review performance | Inspect completion and interaction events where analytics are connected | “Where are learners having difficulty?” | Too much data; no connection between event and slide | Report by lesson, slide, and interaction; link directly back to the editor | Teacher identifies an actionable improvement |
| 10. Revise safely | Edit a draft based on feedback and publish a new version | “I need to update this without breaking the current lesson.” | Draft edits changing live content; uncertainty about versions | Keep draft and published versions separate and show change history | New version is published without affecting the prior version prematurely |

---

## 17. Critical Moments of Truth

### 17.1 First element insertion

The teacher must immediately understand how elements are added and edited.

### 17.2 First chronological effect

The product must demonstrate that sequencing can be accomplished without requiring timeline expertise.

### 17.3 First preview

The teacher must trust that the preview accurately represents the learner experience.

### 17.4 First interaction

The teacher must understand the difference between an ordinary timed slide and a slide that waits for learner input.

### 17.5 First publish

The teacher must feel confident that work is saved, validated, and recoverable.

### 17.6 First revision after publication

The teacher must be able to change a draft without unexpectedly changing the live lesson.

---

# Part IV — Software Requirements Specification

## 18. SRS Purpose

This SRS defines the expected behavior of the Cuestack Studio authoring application, the Cuestack lesson format, the publishing process, and the Cuestack learner playback framework.

The specification is implementation-independent unless a technical constraint is necessary to ensure consistent authoring and playback.

---

## 19. System Scope

The system includes:

- Web-based lesson authoring
- Lesson and slide management
- Visual canvas editing
- Element configuration
- Timeline and effects editing
- Interaction authoring
- Teacher preview
- Lesson validation
- Versioning and publishing
- Learner playback
- Extensible element and effect framework
- Basic authoring and learner event tracking

The system excludes:

- AI lesson generation
- Student enrollment
- Gradebook administration
- Complex LMS administration
- Live video teaching
- Professional video compositing
- Adaptive learning algorithms
- Real-time collaborative editing in the MVP

---

## 20. Definitions

| Term | Definition |
|---|---|
| Lesson | The top-level authored learning experience containing ordered slides |
| Slide | A visual scene containing elements, timeline behavior, transition, and progression rules |
| Element | A content object placed on a slide, such as text, image, video, shape, or question |
| Canvas | The visual editing surface representing the slide |
| Timeline | A time-based view showing when slide elements and effects are active |
| Effect | An entrance, emphasis, or exit behavior applied to an element |
| Transition | The visual change between two slides |
| Advance mode | The rule determining when the player moves to the next slide |
| Simple Sequence Mode | A simplified interface for ordering elements relative to one another |
| Timeline Mode | A detailed interface for controlling absolute start and end times |
| Blocking interaction | An interaction that must be completed before the slide can advance |
| Draft | The editable lesson state |
| Published version | An immutable lesson snapshot available to learners |
| Player | The runtime responsible for rendering and controlling a published lesson |
| Logical canvas | The fixed coordinate system used to store element positions independently of display size |
| Lesson manifest | The versioned data structure describing the lesson, slides, elements, effects, and assets |

---

## 21. User Roles

### 21.1 Owner

Can manage the lesson, permissions, publishing, and deletion.

### 21.2 Editor

Can modify lesson content and settings.

### 21.3 Reviewer

Can preview, comment, and approve where approval workflow is enabled.

### 21.4 Viewer

Can preview but cannot modify the lesson.

### 21.5 Learner

Can play a published lesson and submit interactions.

---

## 22. Operating Environment

### Authoring environment

- Desktop or laptop web browser
- Keyboard and pointer input
- Recommended minimum viewport width of 1280 pixels
- Persistent internet connection, with temporary local recovery for connection interruptions

### Learner environment

- Desktop browser
- Tablet browser
- Mobile browser
- Keyboard, touch, or pointer input
- Screen-reader support for accessible content
- Responsive scaling of the logical canvas

### Supported browser target

The product should support the latest two major versions of:

- Chrome
- Edge
- Safari
- Firefox

---

## 23. System Context

```text
Teacher
   │
   ▼
Authoring Application
   ├── Slide Navigator
   ├── Canvas Engine
   ├── Properties Inspector
   ├── Timeline Engine
   ├── Asset Manager
   └── Preview Controller
            │
            ▼
       Lesson Manifest
            │
     ┌──────┴─────────┐
     ▼                ▼
Publishing Service   Version Storage
     │
     ▼
Published Manifest + Assets
     │
     ▼
Shared Learner Player
     │
     ├── Playback Events
     └── Interaction Events
```

---

## 24. Primary User Interface

The main Cuestack Studio interface shall contain five primary regions.

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | Save state | Preview | Publish     │
├─────────────┬──────────────────────────────┬────────────────┤
│ Slide       │                              │ Properties     │
│ Navigator   │ Canvas                       │ Inspector       │
│             │                              │                │
│ Slide 1     │ Selected slide and elements  │ Context-based  │
│ Slide 2     │                              │ settings       │
│ Slide 3     │                              │                │
├─────────────┴──────────────────────────────┴────────────────┤
│ Timeline: tracks | playhead | timing | effects | controls  │
└─────────────────────────────────────────────────────────────┘
```

The properties inspector shall display settings based on the current selection:

- Lesson selected
- Slide selected
- Element selected
- Effect selected
- Interaction selected

---

# 25. Functional Requirements

Priority definitions:

- **Must:** Required for MVP
- **Should:** Important for the first major release after MVP
- **Could:** Valuable future capability

---

## 25.1 Lesson Management

| ID | Requirement | Priority |
|---|---|---|
| FR-LSN-001 | The system shall allow an authenticated teacher to create a new lesson. | Must |
| FR-LSN-002 | The system shall allow a lesson to be created as blank or from an authorized template. | Must |
| FR-LSN-003 | The system shall store lesson title, description, owner, status, language, aspect ratio, and theme. | Must |
| FR-LSN-004 | The system shall support Draft, In Review, Published, and Archived statuses. | Must |
| FR-LSN-005 | The system shall allow authorized users to duplicate a lesson. | Must |
| FR-LSN-006 | The system shall allow authorized users to archive and restore a lesson. | Must |
| FR-LSN-007 | The system shall enforce Owner, Editor, Reviewer, and Viewer permissions. | Should |
| FR-LSN-008 | The system shall provide a default 16:9 lesson aspect ratio. | Must |
| FR-LSN-009 | The system should support additional aspect ratios, including 4:3 and 9:16. | Should |
| FR-LSN-010 | The system shall allow lesson-level theme settings to define default fonts, colors, spacing, and controls. | Must |

---

## 25.2 Slide Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SLD-001 | The system shall allow teachers to add, duplicate, delete, and restore slides. | Must |
| FR-SLD-002 | The system shall allow slides to be reordered through drag-and-drop and keyboard commands. | Must |
| FR-SLD-003 | Each slide thumbnail shall display its order, preview image, duration, and advance mode. | Must |
| FR-SLD-004 | Teachers shall be able to assign an internal name to each slide. | Must |
| FR-SLD-005 | Teachers shall be able to configure a slide background using a color, gradient, or image. | Must |
| FR-SLD-006 | Teachers shall be able to define slide duration in milliseconds through a seconds-based interface. | Must |
| FR-SLD-007 | Teachers shall be able to select a slide transition and transition duration. | Must |
| FR-SLD-008 | The system shall warn before deleting a slide containing elements or interactions. | Must |
| FR-SLD-009 | The system should allow slides to be copied between lessons when the user has access to both lessons. | Should |
| FR-SLD-010 | The system should support grouping slides into named lesson sections. | Should |
| FR-SLD-011 | The system should support multi-select operations for duplication, deletion, and movement. | Should |
| FR-SLD-012 | The system shall automatically recalculate slide order after a slide is moved or deleted. | Must |

---

## 25.3 Canvas and Element Authoring

| ID | Requirement | Priority |
|---|---|---|
| FR-CAN-001 | The MVP shall support text, image, shape, video, audio, button, multiple-choice question, and true-or-false elements. | Must |
| FR-CAN-002 | Teachers shall be able to add elements through an Add menu. | Must |
| FR-CAN-003 | Teachers should be able to search for and insert elements through a slash-command menu. | Should |
| FR-CAN-004 | Teachers shall be able to move, resize, and rotate supported elements. | Must |
| FR-CAN-005 | Teachers shall be able to edit text directly on the canvas. | Must |
| FR-CAN-006 | The properties inspector shall expose settings appropriate to the selected element type. | Must |
| FR-CAN-007 | The canvas shall provide snapping guides, alignment, and distribution controls. | Must |
| FR-CAN-008 | Teachers shall be able to move elements forward or backward in the layer order. | Must |
| FR-CAN-009 | Teachers shall be able to lock and hide elements in the editor. | Must |
| FR-CAN-010 | Teachers shall be able to duplicate, copy, paste, and delete selected elements. | Must |
| FR-CAN-011 | The editor shall support undo and redo for content, layout, and timing changes. | Must |
| FR-CAN-012 | The editor shall support keyboard movement and common copy, paste, delete, undo, and redo shortcuts. | Must |
| FR-CAN-013 | Teachers shall be able to upload and reuse assets from an asset library. | Must |
| FR-CAN-014 | Image elements shall support alt text and optional captions. | Must |
| FR-CAN-015 | Video elements shall support captions, poster images, volume settings, and optional controls. | Must |
| FR-CAN-016 | Audio elements shall support volume, autoplay-after-user-start, and optional controls. | Must |
| FR-CAN-017 | Element geometry shall be stored using a stable logical coordinate system. | Must |
| FR-CAN-018 | The player shall scale the logical canvas proportionally to the available viewport. | Must |
| FR-CAN-019 | The system should support grouping multiple elements for movement and resizing. | Should |
| FR-CAN-020 | The system should support reusable components or saved element groups. | Could |

---

## 25.4 Timeline and Timing

| ID | Requirement | Priority |
|---|---|---|
| FR-TIM-001 | The system shall provide a timeline associated with the selected slide. | Must |
| FR-TIM-002 | Each timed element shall have a corresponding timeline track. | Must |
| FR-TIM-003 | Teachers shall be able to set each element’s start time and end time. | Must |
| FR-TIM-004 | Teachers shall be able to change timing by dragging track bars and handles. | Must |
| FR-TIM-005 | The timeline shall display a movable playhead. | Must |
| FR-TIM-006 | Teachers shall be able to seek by clicking or dragging on the timeline ruler. | Must |
| FR-TIM-007 | The timeline shall provide play, pause, restart, and current-time controls. | Must |
| FR-TIM-008 | The timeline shall support zooming to different time scales. | Should |
| FR-TIM-009 | Timing values shall be stored as non-negative integer milliseconds. | Must |
| FR-TIM-010 | The system shall support entrance, emphasis, and exit effects. | Must |
| FR-TIM-011 | The initial effect library shall include Appear, Fade, Slide, Zoom, Pulse, Highlight, Dim, and Disappear. | Must |
| FR-TIM-012 | Teachers shall be able to configure effect duration and supported effect parameters. | Must |
| FR-TIM-013 | Multiple effects on one element shall execute according to chronological start time. | Must |
| FR-TIM-014 | When two effects have the same start time, the system shall use a deterministic stored order. | Must |
| FR-TIM-015 | The system shall prevent invalid negative durations. | Must |
| FR-TIM-016 | The system shall identify effects or elements that extend beyond the current slide duration. | Must |
| FR-TIM-017 | Teachers shall be able to extend the slide automatically to include the latest element or effect. | Must |
| FR-TIM-018 | The system shall support synchronizing an element’s visibility with video or audio playback. | Must |
| FR-TIM-019 | The player shall use a monotonic playback clock rather than relying only on independent CSS animation delays. | Must |
| FR-TIM-020 | The player shall apply the current timeline state correctly after seeking. | Must |

---

## 25.5 Simple Sequence Mode

| ID | Requirement | Priority |
|---|---|---|
| FR-SEQ-001 | The system shall provide a simplified alternative to the full timeline. | Must |
| FR-SEQ-002 | Teachers shall be able to configure an element to start With Previous. | Must |
| FR-SEQ-003 | Teachers shall be able to configure an element to start After Previous. | Must |
| FR-SEQ-004 | Teachers shall be able to configure a custom delay after the previous event. | Must |
| FR-SEQ-005 | Simple Sequence Mode shall convert relative relationships into absolute timeline values. | Must |
| FR-SEQ-006 | Switching to Timeline Mode shall preserve all generated timing values. | Must |
| FR-SEQ-007 | Manual timeline changes that cannot be represented simply shall cause the sequence to be marked Custom. | Must |
| FR-SEQ-008 | Returning a Custom sequence to Simple Sequence Mode shall require confirmation if timing precision would be changed. | Must |

---

## 25.6 Slide Advancement

| ID | Requirement | Priority |
|---|---|---|
| FR-ADV-001 | The system shall support an After Duration advance mode. | Must |
| FR-ADV-002 | The system shall support an On Learner Click advance mode. | Must |
| FR-ADV-003 | The system shall support an After Selected Media Ends advance mode. | Must |
| FR-ADV-004 | The system shall support an After Required Interaction Completes advance mode. | Must |
| FR-ADV-005 | After Duration shall advance only after the configured slide duration and required exit behavior have completed. | Must |
| FR-ADV-006 | After Selected Media Ends shall require the teacher to identify the controlling media element. | Must |
| FR-ADV-007 | Deleting controlling media shall invalidate the media-end advance rule and produce a visible validation error. | Must |
| FR-ADV-008 | A required interaction shall take precedence over automatic duration-based progression. | Must |
| FR-ADV-009 | Teachers shall be able to determine whether learners can navigate backward. | Must |
| FR-ADV-010 | Teachers should be able to determine whether learners may manually skip an automatically timed slide. | Should |
| FR-ADV-011 | The preview shall allow the teacher to temporarily override progression for testing. | Must |
| FR-ADV-012 | The player shall prevent duplicate advancement caused by simultaneous conditions. | Must |

---

## 25.7 Interactions and Questions

| ID | Requirement | Priority |
|---|---|---|
| FR-INT-001 | The MVP shall support single-answer multiple choice and true-or-false questions. | Must |
| FR-INT-002 | The system should support multiple-select, short-answer, matching, and ordering interactions. | Should |
| FR-INT-003 | Teachers shall be able to define the prompt, answer options, correct answer, and feedback. | Must |
| FR-INT-004 | Teachers shall be able to mark an interaction as required or optional. | Must |
| FR-INT-005 | Teachers shall be able to configure whether the learner may retry. | Must |
| FR-INT-006 | Teachers shall be able to configure the maximum number of attempts. | Must |
| FR-INT-007 | Teachers shall be able to provide correct-answer and incorrect-answer feedback. | Must |
| FR-INT-008 | Teachers should be able to assign points and shuffle answer options. | Should |
| FR-INT-009 | Required interactions shall expose a completion state to the slide player. | Must |
| FR-INT-010 | The system shall support timed appearance and disappearance of interaction elements. | Must |
| FR-INT-011 | A required interaction shall not disappear before completion unless the teacher resolves the resulting validation error. | Must |
| FR-INT-012 | Learner responses shall emit structured interaction events. | Must |
| FR-INT-013 | Interaction controls shall be operable through keyboard input. | Must |
| FR-INT-014 | Interaction state and feedback shall be communicated to screen readers. | Must |

---

## 25.8 Preview and Learner Player

| ID | Requirement | Priority |
|---|---|---|
| FR-PLY-001 | The editor preview and learner player shall use the same core renderer and timing engine. | Must |
| FR-PLY-002 | Teachers shall be able to preview from the beginning of the lesson. | Must |
| FR-PLY-003 | Teachers shall be able to preview from the current slide. | Must |
| FR-PLY-004 | Teachers shall be able to preview from the current timeline position. | Must |
| FR-PLY-005 | Preview shall provide play, pause, seek, previous, next, restart, and close controls. | Must |
| FR-PLY-006 | Preview should provide desktop, tablet, and mobile viewport presets. | Should |
| FR-PLY-007 | The player shall require an initial user action before beginning playback that contains audible autoplay media. | Must |
| FR-PLY-008 | The player shall pause its visual timeline when the browser document becomes hidden. | Must |
| FR-PLY-009 | The player shall resume from the paused timeline position when the document becomes active again. | Must |
| FR-PLY-010 | The player shall preload the next slide manifest and eligible assets. | Must |
| FR-PLY-011 | The player shall display a recoverable error state when an asset fails to load. | Must |
| FR-PLY-012 | Failure of a nonessential decorative asset shall not prevent the remaining slide from playing. | Must |
| FR-PLY-013 | The player shall display lesson progress where enabled by the teacher or organization. | Must |
| FR-PLY-014 | The player shall display a completion state after the final slide. | Must |
| FR-PLY-015 | The player should support resuming a partially completed lesson. | Should |
| FR-PLY-016 | The player shall not expose editor-only controls or hidden authoring metadata. | Must |
| FR-PLY-017 | The player shall support reduced-motion behavior based on user preferences. | Must |
| FR-PLY-018 | Preview and published playback shall remain within the defined timing tolerance for non-streaming elements. | Must |

---

## 25.9 Saving and Recovery

| ID | Requirement | Priority |
|---|---|---|
| FR-DAT-001 | The editor shall automatically save changes after a short idle interval. | Must |
| FR-DAT-002 | The editor shall display Saving, Saved, Offline, and Save Failed states. | Must |
| FR-DAT-003 | The system shall not mark content Saved until the server acknowledges persistence. | Must |
| FR-DAT-004 | The editor shall maintain a local queue for changes made during a temporary connection interruption. | Must |
| FR-DAT-005 | The system shall attempt to synchronize queued changes after connectivity returns. | Must |
| FR-DAT-006 | The system shall detect conflicting edits to the same lesson version. | Must |
| FR-DAT-007 | The system shall not silently overwrite a newer server version. | Must |
| FR-DAT-008 | The system shall maintain version history for lesson drafts. | Must |
| FR-DAT-009 | Authorized users shall be able to restore an earlier draft version. | Must |
| FR-DAT-010 | Restoring a version shall create a new draft version rather than deleting later history. | Must |

---

## 25.10 Validation and Publishing

| ID | Requirement | Priority |
|---|---|---|
| FR-PUB-001 | The system shall validate a lesson before publication. | Must |
| FR-PUB-002 | Validation shall distinguish errors from warnings. | Must |
| FR-PUB-003 | Errors shall block publication. | Must |
| FR-PUB-004 | Each validation result shall identify the affected slide and element where applicable. | Must |
| FR-PUB-005 | The system shall provide a direct navigation action from a validation issue to its source. | Must |
| FR-PUB-006 | Publishing shall create an immutable lesson snapshot. | Must |
| FR-PUB-007 | Changes to the draft shall not affect the active published version. | Must |
| FR-PUB-008 | An authorized user shall be able to publish a newer version. | Must |
| FR-PUB-009 | The system shall retain the identity and timestamp of the publishing user. | Must |
| FR-PUB-010 | The system shall support unpublishing or archiving according to user permissions. | Must |
| FR-PUB-011 | Published lessons shall be available through a stable player URL or integration identifier. | Must |
| FR-PUB-012 | The system should support embedding the player in an approved host application. | Should |
| FR-PUB-013 | The system should support export and import of a versioned lesson package. | Should |
| FR-PUB-014 | A published package shall reference only authorized and available assets. | Must |
| FR-PUB-015 | The system shall maintain an audit record of publish, unpublish, archive, and restore actions. | Must |

---

## 25.11 Review and Collaboration

| ID | Requirement | Priority |
|---|---|---|
| FR-COL-001 | A Reviewer shall be able to preview a lesson without editing it. | Should |
| FR-COL-002 | A Reviewer should be able to leave a comment on a lesson, slide, or element. | Should |
| FR-COL-003 | Comments should support Open and Resolved states. | Should |
| FR-COL-004 | The system should support a Requested Changes review state. | Should |
| FR-COL-005 | The system should identify the lesson version reviewed or approved. | Should |
| FR-COL-006 | Real-time simultaneous editing is outside the MVP scope. | Must |

---

## 25.12 Framework Extensibility

| ID | Requirement | Priority |
|---|---|---|
| FR-FWK-001 | The framework shall use a registry for supported element types. | Must |
| FR-FWK-002 | An element plugin shall define its data schema, editor component, player renderer, inspector configuration, and validator. | Must |
| FR-FWK-003 | The framework shall use a registry for supported effect types. | Must |
| FR-FWK-004 | An effect plugin shall define supported target elements, parameters, timing behavior, editor preview, and player implementation. | Must |
| FR-FWK-005 | The lesson manifest shall include a schema version. | Must |
| FR-FWK-006 | The framework shall support migration functions between supported schema versions. | Must |
| FR-FWK-007 | The player shall fail gracefully when encountering an unknown optional element type. | Must |
| FR-FWK-008 | The player shall block playback and report an actionable error when an unknown required interaction type is encountered. | Must |
| FR-FWK-009 | The framework shall expose lifecycle events for lesson start, slide start, element visibility, interaction completion, slide advance, and lesson completion. | Must |
| FR-FWK-010 | The framework shall support theme tokens independently of individual element implementations. | Must |
| FR-FWK-011 | Element plugins shall not receive unrestricted access to unrelated lesson or user data. | Must |
| FR-FWK-012 | New plugin versions shall declare compatibility with lesson schema and player versions. | Must |
| FR-FWK-013 | Automated parity tests shall verify that registered elements render consistently in editor preview and learner playback. | Must |

---

## 25.13 Analytics Events

| ID | Requirement | Priority |
|---|---|---|
| FR-AN-001 | The authoring application shall emit events for lesson creation, slide creation, element insertion, preview start, validation, and publishing. | Must |
| FR-AN-002 | The player shall emit lesson-started, slide-started, slide-completed, interaction-submitted, lesson-paused, lesson-resumed, and lesson-completed events. | Must |
| FR-AN-003 | Interaction events shall identify the lesson version, slide, interaction, attempt, and outcome. | Must |
| FR-AN-004 | Analytics payloads shall avoid unnecessary personally identifiable information. | Must |
| FR-AN-005 | The analytics integration shall be replaceable through an adapter interface. | Should |

---

# 26. Business Rules

| ID | Rule |
|---|---|
| BR-001 | All timeline values shall be stored as integer milliseconds. |
| BR-002 | An element start time shall be greater than or equal to zero. |
| BR-003 | An element end time shall be greater than its start time. |
| BR-004 | An effect duration shall be greater than zero. |
| BR-005 | A required interaction shall override automatic slide advancement until completion. |
| BR-006 | A slide using After Selected Media Ends shall reference an existing playable media element on that slide. |
| BR-007 | The system shall not trigger slide advancement more than once for the same slide state. |
| BR-008 | A published lesson version shall remain immutable. |
| BR-009 | Draft edits shall not alter a previously published version. |
| BR-010 | Elements hidden in the editor shall remain part of the draft but shall not render in preview or playback. |
| BR-011 | Locked elements shall render normally but shall not be transformable until unlocked. |
| BR-012 | Required accessibility metadata may be enforced as an error or warning according to organization policy. |
| BR-013 | The timeline shall pause while the learner browser document is hidden. |
| BR-014 | Video and audio autoplay with sound shall require a user gesture. |
| BR-015 | When reduced motion is active, nonessential movement shall be replaced with reduced or instant alternatives. |
| BR-016 | Simple Sequence Mode shall always resolve to valid absolute timeline values before preview or publication. |
| BR-017 | When slide duration is reduced below an existing event end time, the system shall warn and require the teacher to trim events or extend duration. |
| BR-018 | Published playback shall reference the exact assets included in or authorized for the published version. |

---

# 27. Lesson Data Model

## 27.1 Lesson

Key fields:

- `id`
- `workspaceId`
- `title`
- `description`
- `language`
- `aspectRatio`
- `themeId`
- `status`
- `ownerId`
- `draftVersionId`
- `publishedVersionId`
- `createdAt`
- `updatedAt`

## 27.2 Lesson Version

Key fields:

- `id`
- `lessonId`
- `schemaVersion`
- `versionNumber`
- `slides`
- `assetManifest`
- `createdBy`
- `createdAt`
- `publicationStatus`

## 27.3 Slide

Key fields:

- `id`
- `name`
- `order`
- `durationMs`
- `background`
- `transition`
- `advance`
- `elements`
- `accessibility`
- `metadata`

## 27.4 Element

Key fields:

- `id`
- `type`
- `x`
- `y`
- `width`
- `height`
- `rotation`
- `zIndex`
- `locked`
- `hidden`
- `startMs`
- `endMs`
- `effects`
- `style`
- `payload`
- `accessibility`

## 27.5 Effect

Key fields:

- `id`
- `type`
- `phase`
- `startMs`
- `durationMs`
- `order`
- `easing`
- `parameters`

Supported phases:

- `enter`
- `emphasis`
- `exit`

## 27.6 Interaction

Key fields:

- `interactionType`
- `prompt`
- `options`
- `correctResponse`
- `required`
- `maxAttempts`
- `shuffle`
- `points`
- `correctFeedback`
- `incorrectFeedback`
- `completionPolicy`

## 27.7 Asset

Key fields:

- `id`
- `assetType`
- `source`
- `storageKey`
- `mimeType`
- `size`
- `durationMs`
- `width`
- `height`
- `captionTrack`
- `transcript`
- `altText`
- `checksum`
- `processingStatus`

---

## 28. Example Lesson Manifest

```json
{
  "schemaVersion": "1.0",
  "lesson": {
    "id": "lesson_safety_001",
    "title": "Workplace Safety",
    "aspectRatio": "16:9",
    "themeId": "default"
  },
  "slides": [
    {
      "id": "slide_001",
      "name": "Introduction",
      "order": 1,
      "durationMs": 8000,
      "advance": {
        "mode": "after_duration"
      },
      "transition": {
        "type": "fade",
        "durationMs": 400
      },
      "elements": [
        {
          "id": "element_title",
          "type": "text",
          "x": 120,
          "y": 80,
          "width": 800,
          "height": 120,
          "rotation": 0,
          "zIndex": 1,
          "startMs": 500,
          "endMs": 8000,
          "payload": {
            "text": "Workplace Safety"
          },
          "effects": [
            {
              "id": "effect_title_enter",
              "type": "fade",
              "phase": "enter",
              "startMs": 500,
              "durationMs": 500,
              "order": 1,
              "easing": "ease-out"
            }
          ]
        },
        {
          "id": "element_image",
          "type": "image",
          "x": 200,
          "y": 250,
          "width": 640,
          "height": 360,
          "rotation": 0,
          "zIndex": 2,
          "startMs": 2000,
          "endMs": 8000,
          "payload": {
            "assetId": "asset_worker_image",
            "altText": "Worker wearing safety equipment"
          },
          "effects": [
            {
              "id": "effect_image_enter",
              "type": "slide-up",
              "phase": "enter",
              "startMs": 2000,
              "durationMs": 450,
              "order": 1,
              "easing": "ease-out"
            }
          ]
        }
      ]
    }
  ]
}
```

---

# 29. Playback State Model

The player shall support the following states:

```text
Loading
   ↓
Ready
   ↓
Playing ←→ Paused
   ↓
Waiting for Interaction
   ↓
Transitioning
   ↓
Playing Next Slide
   ↓
Completed
```

An Error state may be entered from Loading, Ready, Playing, Waiting for Interaction, or Transitioning.

### State behavior

- **Loading:** Manifest or required assets are being prepared.
- **Ready:** Lesson is loaded and awaiting user initiation.
- **Playing:** Timeline clock is progressing.
- **Paused:** Timeline clock is stopped while the current visual state remains rendered.
- **Waiting for Interaction:** Timeline may be paused or complete, but progression is blocked.
- **Transitioning:** Current slide exits and the next slide enters.
- **Completed:** Final lesson completion state is displayed.
- **Error:** The player displays an actionable or recoverable error.

---

# 30. Playback Timing Rules

1. Each slide begins at local time `0`.
2. The player uses a monotonic clock to calculate slide time.
3. Element visibility is calculated from `startMs`, `endMs`, and current slide time.
4. Effect progress is calculated from effect start and duration.
5. Seeking shall recalculate the state of every element rather than replaying all prior effects.
6. Media shall synchronize to the current slide time where synchronization is enabled.
7. Required interactions may pause or gate progression according to their configuration.
8. The advance controller shall evaluate the active slide’s advance rule.
9. Only one advance action may be accepted for a slide instance.
10. Transition duration shall not be counted twice when calculating the next slide start.
11. When the browser document becomes hidden, the player clock shall pause.
12. When playback resumes, the player shall continue from the stored slide time rather than adding hidden-tab elapsed time.

---

# 31. Validation Requirements

The validation engine shall check at least the following conditions.

### Blocking errors

- Lesson contains no slides
- Slide contains an invalid negative duration
- Element has an end time before its start time
- Required interaction has no valid correct response
- Media-end advancement references missing media
- Required plugin or element type is unavailable
- Required asset is unavailable
- Published manifest cannot be serialized
- Lesson schema cannot be migrated to the supported version

### Warnings

- Slide contains no visible content
- Element extends beyond slide duration
- Text may be unreadably small
- Image has no alt text
- Video has no captions
- Multiple elements completely overlap
- Automatic slide duration may not allow adequate reading time
- Required interaction disappears before completion
- Excessive simultaneous motion is detected
- Color contrast may be insufficient
- Audio or video begins before the initial user gesture
- Slide contains media that has not completed processing

---

# 32. Nonfunctional Requirements

## 32.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-001 | A typical lesson of up to 50 slides and 300 total elements should become editor-interactive within three seconds, excluding large media transfer time. |
| NFR-PERF-002 | Selection, movement, and resizing feedback should begin within 100 milliseconds of user input. |
| NFR-PERF-003 | Timeline seeking should update visible slide state within 100 milliseconds under normal conditions. |
| NFR-PERF-004 | Basic playback should target 60 frames per second on recommended hardware and remain usable at 30 frames per second. |
| NFR-PERF-005 | Autosave should begin approximately 1.5 seconds after the last eligible editing action. |
| NFR-PERF-006 | The player should render the initial slide within two seconds after the manifest is available, excluding required media download. |
| NFR-PERF-007 | The player should preload the next slide and its priority assets without blocking current-slide playback. |

## 32.2 Reliability and Data Integrity

| ID | Requirement |
|---|---|
| NFR-REL-001 | Acknowledged autosaved work shall not be lost during an ordinary browser refresh. |
| NFR-REL-002 | Unsynchronized local changes shall be recoverable after a temporary connection interruption. |
| NFR-REL-003 | Published snapshots shall be immutable. |
| NFR-REL-004 | Player errors shall identify the lesson version and affected asset or element. |
| NFR-REL-005 | Playback behavior shall be deterministic for the same manifest, player version, and supported browser environment. |
| NFR-REL-006 | Schema migrations shall be testable and reversible through stored source versions or backups. |

## 32.3 Availability

| ID | Requirement |
|---|---|
| NFR-AVL-001 | The production authoring and publishing services should target 99.9% monthly availability. |
| NFR-AVL-002 | Published static manifests and assets should be deliverable independently of temporary authoring-service outages. |
| NFR-AVL-003 | Player delivery should scale independently from editor traffic. |

## 32.4 Security

| ID | Requirement |
|---|---|
| NFR-SEC-001 | All network traffic shall use encrypted transport. |
| NFR-SEC-002 | Stored sensitive data shall use encryption at rest where supported by the platform. |
| NFR-SEC-003 | The system shall enforce server-side authorization for lesson and asset access. |
| NFR-SEC-004 | Multi-tenant deployments shall isolate tenant data. |
| NFR-SEC-005 | Asset access shall use authorized or time-limited URLs where lessons are private. |
| NFR-SEC-006 | Uploaded files shall be validated by type and scanned according to platform security policy. |
| NFR-SEC-007 | Rich text and plugin content shall be sanitized to prevent script injection. |
| NFR-SEC-008 | Audit-sensitive actions shall include authenticated user, timestamp, and target version. |
| NFR-SEC-009 | Plugin execution shall operate within documented permissions and isolation boundaries. |

## 32.5 Accessibility

| ID | Requirement |
|---|---|
| NFR-ACC-001 | The learner player shall target WCAG 2.2 Level AA. |
| NFR-ACC-002 | Core learner navigation shall be keyboard-operable. |
| NFR-ACC-003 | Interactive controls shall provide accessible names, roles, states, and feedback. |
| NFR-ACC-004 | The player shall honor reduced-motion preferences. |
| NFR-ACC-005 | Essential information shall not be communicated through motion or color alone. |
| NFR-ACC-006 | Images shall support alt text. |
| NFR-ACC-007 | Videos shall support captions and transcripts. |
| NFR-ACC-008 | Audio-only content shall support transcripts. |
| NFR-ACC-009 | Teachers shall be warned about likely contrast or text-size issues. |
| NFR-ACC-010 | Automatic progression shall provide a pause mechanism where organization policy requires it. |

## 32.6 Usability

| ID | Requirement |
|---|---|
| NFR-USA-001 | A teacher familiar with presentation software should be able to create a basic lesson without formal training. |
| NFR-USA-002 | Advanced controls shall remain discoverable without being shown by default to every new user. |
| NFR-USA-003 | Destructive actions shall support confirmation or undo. |
| NFR-USA-004 | Error messages shall describe the problem, affected object, and recommended action. |
| NFR-USA-005 | The system shall display save and publication status consistently. |
| NFR-USA-006 | Common actions shall have keyboard shortcuts and visible tooltips. |

## 32.7 Compatibility and Responsiveness

| ID | Requirement |
|---|---|
| NFR-COM-001 | The authoring application shall support the defined desktop browsers. |
| NFR-COM-002 | The learner player shall support desktop, tablet, and mobile browser layouts. |
| NFR-COM-003 | The player shall preserve the authored aspect ratio unless an approved responsive layout mode is used. |
| NFR-COM-004 | Text and interactive controls shall remain usable when the canvas is scaled down. |
| NFR-COM-005 | Unsupported browser features shall produce graceful fallbacks where possible. |

## 32.8 Localization

| ID | Requirement |
|---|---|
| NFR-LOC-001 | Lesson content shall support Unicode. |
| NFR-LOC-002 | The interface shall be designed for localization. |
| NFR-LOC-003 | Text elements shall support left-to-right and right-to-left direction. |
| NFR-LOC-004 | Time, number, and date displays shall use locale-aware formatting. |
| NFR-LOC-005 | Translated interface strings shall not be stored inside lesson content manifests. |

## 32.9 Maintainability

| ID | Requirement |
|---|---|
| NFR-MNT-001 | The authoring and player applications shall consume the same versioned lesson schema. |
| NFR-MNT-002 | Element and effect functionality shall be modular. |
| NFR-MNT-003 | Schema changes shall include migrations and regression tests. |
| NFR-MNT-004 | Core playback logic shall be covered by deterministic automated tests. |
| NFR-MNT-005 | Preview and player parity shall be verified through shared test fixtures. |
| NFR-MNT-006 | The system shall provide structured logs for save, publish, asset, and playback failures. |

## 32.10 Privacy

| ID | Requirement |
|---|---|
| NFR-PRV-001 | The system shall collect only learner data necessary for configured functionality. |
| NFR-PRV-002 | Learner identifiers shall not be embedded unnecessarily in lesson manifests. |
| NFR-PRV-003 | Analytics shall support organization-specific retention policies. |
| NFR-PRV-004 | Exported lesson packages shall not contain author or learner secrets. |

---

# 33. Core Use Cases

## UC-01: Create a Timed Lesson

### Primary actor

Teacher

### Preconditions

- Teacher is authenticated.
- Teacher has permission to create lessons.

### Main flow

1. Teacher selects Create Lesson.
2. Teacher chooses Blank Lesson.
3. System creates a draft lesson with one slide.
4. Teacher enters a lesson title.
5. Teacher adds four additional slides.
6. Teacher adds text and image elements.
7. Teacher configures slide durations.
8. Teacher previews the lesson.
9. System plays the slides according to their configured durations.
10. Teacher publishes the lesson.
11. System validates and creates an immutable published version.

### Alternative flows

- A media asset is still processing; the system displays a warning and blocks publication only when the asset is required.
- Validation finds an element outside the slide duration; the teacher extends the slide automatically.
- Connectivity fails; the system queues changes locally and displays Offline status.

### Success condition

A playable five-slide lesson is available through the published player.

---

## UC-02: Create a Chronological Effect Sequence

### Primary actor

Teacher

### Main flow

1. Teacher selects a slide.
2. Teacher adds a title, image, and explanation.
3. Teacher opens Simple Sequence Mode.
4. Teacher sets the title to start at the beginning.
5. Teacher sets the image to appear After Previous with a one-second delay.
6. Teacher sets the explanation to appear After Previous.
7. System calculates absolute timing.
8. Teacher presses Play.
9. The title, image, and explanation appear in the intended order.
10. Teacher opens Timeline Mode and adjusts the image start time precisely.
11. System marks the sequence Custom and preserves all timing.

### Success condition

The sequence plays identically in the editor preview and learner player.

---

## UC-03: Create a Required Question Slide

### Primary actor

Teacher

### Main flow

1. Teacher adds a multiple-choice interaction.
2. Teacher writes the prompt and answer choices.
3. Teacher identifies the correct answer.
4. Teacher marks the interaction Required.
5. Teacher configures the slide to advance After Required Interaction Completes.
6. Teacher previews the slide.
7. The player waits for a response.
8. Teacher selects an answer.
9. The player displays feedback.
10. The player advances according to the configured completion policy.

### Success condition

The slide cannot advance before the required interaction is completed.

---

## UC-04: Advance After Video Completion

### Primary actor

Teacher

### Main flow

1. Teacher uploads a video.
2. Teacher adds the video to a slide.
3. Teacher selects After Selected Media Ends.
4. Teacher chooses the video as the controlling media.
5. System sets or recommends a slide duration based on the video.
6. Teacher previews the slide.
7. The player waits until the video ends.
8. The player transitions to the next slide.

### Exception

If the video cannot load, the player displays a recoverable error and does not enter an infinite waiting state.

---

## UC-05: Revise a Published Lesson

### Primary actor

Teacher or instructional designer

### Main flow

1. User opens a published lesson.
2. System opens the editable draft associated with the lesson.
3. User changes slide content and timing.
4. Existing learners continue receiving the current published version.
5. User previews and validates the draft.
6. User publishes the new version.
7. System updates the active published-version reference.
8. The previous published version remains available in history.

### Success condition

Draft changes do not affect the live lesson before publication.

---

# 34. MVP Acceptance Scenarios

## Scenario A: Timed effects and automatic progression

Given a slide with an eight-second duration:

- Title fades in at 0.5 seconds.
- Image slides in at 2 seconds.
- Explanation appears at 4 seconds.
- Slide transitions at 8 seconds.

The preview and published player shall execute this sequence in the same order and within the accepted timing tolerance.

## Scenario B: Required interaction overrides timer

Given a slide with a ten-second duration and a required question:

- The timer reaches ten seconds.
- The learner has not answered.
- The player remains on the slide.
- The learner answers.
- Feedback is displayed.
- The player advances according to the configured policy.

## Scenario C: Media-controlled advancement

Given a slide configured to advance after a selected video ends:

- The slide shall not advance while the video is still playing.
- Pausing the video shall also postpone advancement.
- Seeking to the video end shall trigger completion according to the media event.
- A duplicate end event shall not advance two slides.

## Scenario D: Save recovery

Given an editing session with a temporary connection loss:

- The editor displays Offline.
- New changes are placed in a local queue.
- Connectivity returns.
- Changes synchronize.
- The system displays Saved only after server acknowledgement.

## Scenario E: Published-version isolation

Given a published version and an editable draft:

- Editing the draft shall not change the published manifest.
- Publishing the draft shall create a new immutable version.
- The system shall preserve the prior version in history.

## Scenario F: Reduced motion

Given a learner with reduced motion enabled:

- Slide and zoom effects shall use a reduced or instant alternative.
- Content order and timing meaning shall remain understandable.
- Essential information shall not be lost.

---

# 35. Suggested MVP Scope

## Must include

- Lesson creation and metadata
- Slide add, duplicate, delete, and reorder
- 16:9 logical canvas
- Text, image, shape, video, audio, and button elements
- Multiple-choice and true-or-false interactions
- Move, resize, rotate, align, and layer controls
- Slide duration
- Basic transitions
- Timeline tracks and playhead
- Start and end timing
- Entrance and exit effects
- Simple Sequence Mode
- After Duration progression
- On Learner Click progression
- After Media Ends progression
- After Required Interaction progression
- Preview from start, current slide, and current time
- Shared preview and player renderer
- Autosave
- Undo and redo
- Validation
- Immutable published versions
- Basic learner progress and interaction events
- Keyboard-accessible learner controls
- Reduced-motion support

## First follow-up release

- Slide groups or sections
- Multiple-select questions
- Short-answer questions
- Matching and ordering
- Comments and review workflow
- Templates
- Element grouping
- Cross-lesson copy and paste
- Mobile and tablet preview presets
- Export and import package
- Resume progress
- Organization theme management
- More transitions and effects

## Later opportunities

- Branching and conditional navigation
- Variables and learner-specific states
- Voice-over recording
- Audio waveform timeline
- Real-time collaborative editing
- Interactive simulations
- Reusable shared components
- SCORM and xAPI export
- LMS integrations
- Translation workflows
- AI-assisted accessibility checks
- AI-assisted content suggestions
- Advanced analytics
- Offline learner playback

---

# 36. Key Product Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Timeline feels too complicated | Teachers abandon the product | Default to Simple Sequence Mode and reveal advanced controls progressively |
| Simple mode becomes too limited | Advanced users leave for other tools | Preserve full absolute timing and provide Timeline Mode |
| Preview differs from published playback | Teachers lose trust | Use the same renderer, schema, effects, and clock in preview and player |
| Media creates slow or unstable playback | Learners experience delays | Process media, use CDN delivery, preload priority assets, and provide fallbacks |
| Automatic progression reduces comprehension | Learners miss content | Allow pause, manual modes, reading-time warnings, and organization policies |
| Too many effects reduce instructional quality | Lessons become distracting | Provide a curated effect set and excessive-motion warnings |
| Schema changes break old lessons | Published content fails later | Use versioned manifests, migrations, compatibility tests, and immutable snapshots |
| Browser autoplay restrictions break audio lessons | Audio does not begin | Require a clear Start Lesson user gesture |
| Data loss damages teacher trust | Product adoption declines | Use autosave acknowledgement, local recovery, undo, and version history |
| Plugins produce inconsistent behavior | Framework becomes unstable | Define strict plugin contracts, isolation, schema validation, and parity tests |
| Accessibility becomes an afterthought | Learners are excluded | Build accessibility metadata and reduced-motion behavior into core schemas |

---

# 37. Decisions Adopted for This Draft

The following assumptions are treated as product defaults:

1. The teacher manually creates all lesson content.
2. Authoring is desktop-first.
3. Learner playback supports desktop, tablet, and mobile browsers.
4. The first canvas format is 16:9.
5. Timing is stored internally in integer milliseconds.
6. Simple and advanced timing modes use the same underlying data.
7. Required interactions override automatic progression.
8. The player pauses when the browser tab becomes hidden.
9. Audio autoplay requires an initial learner gesture.
10. Draft and published versions remain separate.
11. Preview and learner playback share the same core engine.
12. The MVP is a lesson-authoring and playback framework, not a complete LMS.

---

# 38. Final Product Definition

Cuestack is a teacher-first, slide-based lesson-authoring framework that combines the familiarity of presentation software with the timing, progression, interaction, versioning, and accessibility capabilities required for digital learning.

Its central experience is:

```text
Create slides
      ↓
Place content
      ↓
Sequence content chronologically
      ↓
Choose how each slide advances
      ↓
Add learner interactions
      ↓
Preview the exact learner experience
      ↓
Validate and publish
```

The product should remain deliberately narrower than a professional animation tool and more visually expressive than a traditional LMS lesson form.

The essential promise is:

> **Teachers control what appears, when it appears, and what the learner must do next—without needing to understand code or professional animation software.**