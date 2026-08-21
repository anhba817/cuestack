import type { LessonManifest, Slide } from '@cuestack/schema'
import {
  createAdvanceController,
  createTransport,
  learnerMayLeave,
  resolve,
  type AdvanceController,
  type Ports,
  type ResolvedElement,
} from '@cuestack/core'
import { applyTo, canvasPropertiesFor, visibleOf } from './frame.js'
import { covers } from './covered.js'
import { browserPorts } from './ports.js'
import { renderElement, type AssetResolver, type NavigationAccess } from './renderers.js'
import { STYLESHEET } from './styles.js'

/**
 * A lesson, played with no UI framework present.
 *
 * **The kernel is shared, not copied.** `resolve`, `createClock`, and `createTransport` come from
 * `@cuestack/core` and nothing here reimplements them — that is the claim this package exists to
 * test, and a structural suite asserts it. In particular there is no second clock: the clamp that
 * turns a paused debugger's enormous delta into a survivable frame lives in core's, and an adapter
 * with its own would lose the reason it exists.
 *
 * What differs from `@cuestack/react` is only the layer that writes to a screen.
 *
 * **Per instance, never global.** Each element owns its clock, its transport, and its frame loop
 * inside its own shadow root, so two lessons on a page cannot reach each other's timing, state, or
 * styles. The loop is cancelled on disconnect — one that outlives its element makes a page slower
 * the longer somebody uses it, and nobody traces that back to a lesson they closed.
 */
/**
 * The base class, or a stand-in where there is no DOM.
 *
 * **`class extends HTMLElement` is evaluated at module load, not at first use.** So a bare
 * `extends HTMLElement` makes `import '@cuestack/element'` throw `ReferenceError: HTMLElement is
 * not defined` in *any* server process — which is every host doing SSR, in a module shared between
 * server and client, before a browser is ever involved. The registration guard further down does
 * not help: it protects the `define` call, and the crash happens on the line above it.
 *
 * Found by `check:element-isolation`, which imports the packed tarball in a bare node process. No
 * test in the suite could have found it, because every one of them runs in happy-dom.
 *
 * On a server the resulting class is inert — importable, never constructed, since `customElements`
 * does not exist to construct it. That is the right outcome: a host's bundle graph resolves, and
 * the component does its work in the only place it can.
 */
const Base: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement

export class LessonElement extends Base {
  #manifest: LessonManifest | null = null
  #resolveAsset: AssetResolver | undefined
  #ports: Pick<Ports, 'time' | 'visibility'> | undefined
  #root: ShadowRoot | null = null
  #stage: HTMLElement | null = null
  #frame: number | null = null
  #transport: ReturnType<typeof createTransport> | null = null
  #advance: AdvanceController | null = null
  #nodes = new Map<string, HTMLElement>()
  #slideIndex = -1
  #announcedStart = false
  #learnerAdvanced = false
  #leaving: { node: HTMLElement; untilMs: number; toIndex: number } | null = null
  /** The problem code currently on screen, or null. Compared per frame; see `#reportProblems`. */
  #shownProblem: string | null = null

  static get observedAttributes(): string[] {
    return ['src', 'autoplay']
  }

  /** A property rather than an attribute: a manifest is an object, not a string to escape. */
  set manifest(value: LessonManifest | null) {
    this.#manifest = value
    if (this.isConnected) this.#start()
  }

  get manifest(): LessonManifest | null {
    return this.#manifest
  }

  set resolveAsset(fn: AssetResolver | undefined) {
    this.#resolveAsset = fn
  }

  /** Injected in tests so nothing waits on wall-clock time (Constitution II). */
  set ports(value: Pick<Ports, 'time' | 'visibility'> | undefined) {
    this.#ports = value
  }

  /**
   * `src` and `autoplay`, both declared in `observedAttributes` above.
   *
   * They were declared there from the first draft and honoured by nothing — no
   * `attributeChangedCallback` existed. That is worse than omitting them: `observedAttributes`
   * announces to the platform that this element reacts to those names, so a host reading the class
   * sees a supported attribute and gets silence.
   */
  attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
    if (previous === value) return
    if (name === 'src' && value) void this.#fetch(value)
    // `autoplay` added after connection starts playback; removing it does not stop a lesson that is
    // already running, because a learner mid-lesson is not a configuration change.
    if (name === 'autoplay' && value !== null && this.#transport) this.play()
  }

  /**
   * Fetch a lesson named by `src`.
   *
   * **No retry, by contract** (§5): fetching is the host's responsibility and a framework that
   * retried on its own would be making a policy decision about someone else's network. What it does
   * do is *report* — a blank rectangle tells a host nothing, and the message is written for a person
   * because the host would be writing a worse one from less information.
   */
  async #fetch(src: string): Promise<void> {
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      this.manifest = (await response.json()) as LessonManifest
    } catch (error) {
      this.#report({
        code: 'LESSON_FETCH_FAILED',
        message:
          `This lesson could not be loaded from ${src} (${error instanceof Error ? error.message : 'unknown error'}). ` +
          'Nothing is retried here — the page that embedded the lesson owns fetching it.',
      })
    }
  }

  /** Begin, or resume. A host with no `autoplay` attribute calls this. */
  play(): void {
    if (!this.#transport) return
    this.#transport.play()
    // Once per lesson, not once per resume: a host logging this would otherwise count a pause as a
    // second start, and `lesson_started` means what it says.
    if (!this.#announcedStart && this.#manifest) {
      this.#announcedStart = true
      this.#emit('cuestack:started', { lessonId: this.#manifest.lesson.id })
    }
  }

  /** Hold. Lesson time stops, so nothing advances and no effect moves. */
  pause(): void {
    this.#transport?.pause()
  }

  /**
   * Go to a slide by **id**, not index.
   *
   * An id is what a host has — it is what the manifest and the authoring tools use, and an index is
   * an implementation detail of the array. An unknown id does nothing rather than throwing: a host
   * holding a stale id gets no movement, not an exception it did not ask to handle.
   */
  seekToSlide(slideId: string): void {
    const index = this.#manifest?.slides.findIndex((slide) => slide.id === slideId) ?? -1
    if (index < 0) return
    this.#transport?.goToSlide(index)
    this.#draw()
  }

  connectedCallback(): void {
    if (!this.#root) {
      // Open rather than closed: a closed root is unreachable from a test and from a host debugging
      // its own page, and the isolation it adds is against the page's author, who is not the
      // adversary here.
      this.#root = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      // Framework-authored CSS, not author content — and set through textContent regardless, because
      // the habit is what leaks into element content.
      style.textContent = STYLESHEET
      this.#stage = document.createElement('div')
      this.#stage.className = 'cs-stage'
      // A programmatic focus target, not a stop on the way through the page: focus is *sent*
      // here when the content under it is replaced.
      this.#stage.tabIndex = -1
      this.#root.append(style, this.#stage)
    }
    if (this.#manifest) this.#start()
  }

  disconnectedCallback(): void {
    this.#stop()
  }

  #stop(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame)
    this.#frame = null
  }

  #start(): void {
    const manifest = this.#manifest
    if (!manifest || !this.#stage) return

    this.#stop()
    const ports = this.#ports ?? browserPorts()

    // No second clock: `createTransport` builds one from the injected time source, and the clamp
    // that survives a paused debugger lives inside it.
    // Reset, or assigning a second manifest leaves the index pointing into the previous lesson and
    // the first slide of the new one is treated as a continuation rather than a beginning.
    this.#slideIndex = -1
    this.#clearTransition()
    this.#transport = createTransport(manifest, { time: ports.time, visibility: ports.visibility })
    /**
     * The kernel's advance rule, not a second one.
     *
     * A `slideTimeMs >= durationMs` comparison here would have been three lines and wrong in every
     * way the controller exists to be right about: `after_media_ends`, `after_interaction`, the
     * per-*instance* decision that lets a learner replay a slide, and the reachability check. FR-009
     * is not only about `resolve` — it is about every rule the kernel owns, and this is one.
     *
     * No media port is passed. This adapter renders none, so the null port's honest answer is that
     * media never ends; a slide gated on it is unsatisfiable here, which `#uncoveredGate` reports.
     */
    /**
     * The canvas the stylesheet measures every coordinate against, written before the first frame.
     *
     * Not per element and not per frame: it is a property of the lesson, and the geometry rules
     * divide by it. Missing, every `calc()` in the stylesheet has an undefined divisor and the
     * layout collapses — which is the loudest possible failure and therefore the right shape for
     * something that must be set exactly once.
     */
    if (this.#stage) {
      for (const [property, value] of Object.entries(
        canvasPropertiesFor(manifest.lesson.aspectRatio),
      )) {
        this.#stage.style.setProperty(property, value)
      }
    }

    this.#advance = createAdvanceController(undefined)
    this.#announcedStart = false
    /**
     * **Only on `autoplay`.** The contract says an absent attribute means the host calls `play()`,
     * and the React player takes the same prop for the same reason: a lesson below the fold that
     * started itself has already run past the part nobody saw.
     */
    if (this.hasAttribute('autoplay')) this.play()

    const loop = (): void => {
      this.#draw()
      this.#frame = requestAnimationFrame(loop)
    }
    this.#frame = requestAnimationFrame(loop)
    this.#draw()
  }

  #draw(): void {
    const manifest = this.#manifest
    const transport = this.#transport
    if (!manifest || !transport || !this.#stage) return

    const slide = manifest.slides[transport.slideIndex]
    if (!slide) return

    if (transport.slideIndex !== this.#slideIndex) {
      this.#enterSlide(transport.slideIndex, slide as Slide)
    }
    this.#settleTransition(transport.slideIndex, transport.slideTimeMs)

    const state = resolve(slide as Slide, transport.slideTimeMs)
    const seen = new Set<string>()

    for (const element of visibleOf(state)) {
      seen.add(element.id)
      let node = this.#nodes.get(element.id)
      if (!node) {
        node = document.createElement('div')
        node.className = 'cs-element'
        /**
         * `data-cs-element-id` and `-type`, matching `ElementFrame.tsx` exactly rather than
         * approximately. The first draft wrote a single `data-cs-element` holding the id, which is
         * the same information under a name no other adapter uses — a host styling or testing
         * against one player would have found the other silently different, and the agreement
         * suite could not compare them at all because it could not find the same nodes twice.
         */
        node.dataset['csElementId'] = element.id
        node.dataset['csElementType'] = element.type
        this.#nodes.set(element.id, node)
        this.#stage.append(node)
      }
      // Structure is rebuilt only when the element arrives; per-frame work is style writing, which
      // is what keeps the loop inside the frame budget.
      if (!node.firstChild) {
        const drawn = renderElement(element, document, this.#resolveAsset, (el) =>
          this.#navigationFor(el),
        )
        // Asked of the node rather than compared against its class string: `className === '…'` was
        // exactly true only while the notice had precisely one class, and would have gone quietly
        // false the first time it gained a second one.
        if (drawn.hasAttribute('data-cs-notice')) node.dataset['csUnavailable'] = 'true'
        node.append(drawn)
      }
      applyTo(node, element)
    }

    for (const [id, node] of this.#nodes) {
      if (seen.has(id)) continue
      node.remove()
      this.#nodes.delete(id)
    }

    this.#reportProblems(state, slide as Slide)
    this.#advanceIfDue(manifest, slide as Slide, transport)
  }

  /**
   * Ask the kernel whether this slide is over, and act on the answer.
   *
   * `evaluate` is a query rather than a command — deliberately, so a test can assert the decision
   * without a transport and the editor can show "would advance now" without advancing. Applying it
   * is the consumer's job, which here means this.
   *
   * `completedInteractions` is empty and always will be: this adapter renders no interactions, so
   * there is nothing a learner could have completed. That is not a stub — it is the true answer, and
   * it is what makes a slide gated on an interaction stay put and get reported rather than skipped.
   */
  #advanceIfDue(
    manifest: LessonManifest,
    slide: Slide,
    transport: ReturnType<typeof createTransport>,
  ): void {
    const controller = this.#advance
    if (!controller) return

    const decision = controller.evaluate(
      slide,
      {
        state: transport.state,
        slideIndex: transport.slideIndex,
        slideTimeMs: transport.slideTimeMs,
        instanceId: transport.instanceId,
      },
      {
        // Read and cleared in one step: one press is one movement, and a flag left raised would
        // advance every subsequent slide the moment it was evaluated.
        learnerAdvanced: ((): boolean => {
          const asked = this.#learnerAdvanced
          this.#learnerAdvanced = false
          return asked
        })(),
        completedInteractions: new Set<string>(),
      },
    )
    if (!decision) return

    const next = transport.slideIndex + 1
    // The last slide holds rather than running off the end. A lesson that ended by rendering
    // nothing would look like a crash to a learner and to the host embedding it — but the host is
    // told, once, because "the lesson finished" is the event it most wants and cannot infer.
    if (next >= manifest.slides.length) {
      /**
       * **Unguarded, deliberately — and it carried a flag that was wrong.**
       *
       * `#advanceIfDue` only reaches this line when the controller *decided*, and
       * `createAdvanceController` keys decisions on `transport.instanceId` and returns null
       * afterwards. So the kernel already guarantees one event per visit, and a flag here adds
       * nothing on a first pass.
       *
       * What it did add was a bug. Seeking back bumps the visit count, so replaying gives the last
       * slide a *new* instance id, the kernel decides again — and the flag swallowed it. A learner
       * who finished a lesson twice was reported as finishing it once. Measured both ways: with the
       * flag, one completion across a replay; without, two.
       *
       * The general shape is worth keeping: a defensive flag layered over a kernel guarantee reads
       * as belt-and-braces and is really a second, worse rule that eventually disagrees.
       */
      this.#emit('cuestack:completed', { lessonId: manifest.lesson.id })
      return
    }
    transport.goToSlide(next)
  }

  /**
   * A slide change: the outgoing stage is kept on screen while the authored transition runs.
   *
   * **The DOM contract is the React player's**, not a second one — `.cs-transition` around the two
   * halves, `data-cs-transition` naming each half's role, `data-cs-transition-type` naming the
   * effect, and the duration as `--cs-transition-ms`. A host with one stylesheet for both players is
   * the whole point of matching it; two adapters that animated the same authored transition through
   * differently-named hooks would each need their own CSS.
   *
   * The leaving half is a *clone*, deliberately. The live stage keeps its identity and its node map
   * so the incoming slide draws into it as usual; the clone is frozen at the last frame of the slide
   * that is going, which is exactly what it should show — nothing on it is still animating.
   */
  #enterSlide(index: number, slide: Slide): void {
    const previous = this.#slideIndex
    this.#slideIndex = index
    this.#emit('cuestack:slide', { slideId: slide.id, index })


    // Every element belongs to its slide. Clearing the map is what makes the incoming slide build
    // its own nodes rather than inherit ids that happen to match.
    for (const node of this.#nodes.values()) node.remove()
    this.#nodes.clear()
    // Forget what was shown, so returning to a wall reports it again rather than staying silent.
    this.#shownProblem = null
    this.#stage?.querySelector('[data-cs-problem]')?.remove()

    this.#clearTransition()
    if (previous < 0 || !this.#stage || !this.#root) return

    /**
     * Put a keyboard user on the slide they arrived at.
     *
     * **After the transition is arranged, not before.** `#enterSlide` moves the live stage into a
     * wrapper when a transition runs, and focusing a node before moving it loses the focus — which
     * is how the first version of this failed, silently and in exactly the case a transition makes
     * most likely.
     *
     * **Not on the first slide** — `previous < 0` above already returned, and focusing on mount
     * would take focus from the host's page, which no learner asked for.
     *
     * A test asserting this must read the **shadow root's** `activeElement`;
     * `document.activeElement` reports the host and would pass while proving nothing.
     */
    const focusStage = (): void => this.#stage?.focus()

    const authored = slide.transition as { type?: string; durationMs?: number } | undefined
    if (!authored || authored.type === 'none' || !authored.durationMs) {
      focusStage()
      return
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'cs-transition'

    const leaving = this.#stage.cloneNode(true) as HTMLElement
    leaving.dataset['csTransition'] = 'leaving'
    leaving.dataset['csTransitionType'] = authored.type
    leaving.style.setProperty('--cs-transition-ms', String(authored.durationMs))
    // Or the slide being replaced is read out alongside the one replacing it.
    leaving.setAttribute('aria-hidden', 'true')

    this.#stage.dataset['csTransition'] = 'entering'
    this.#stage.dataset['csTransitionType'] = authored.type
    this.#stage.style.setProperty('--cs-transition-ms', String(authored.durationMs))

    this.#stage.replaceWith(wrapper)
    wrapper.append(leaving, this.#stage)

    /**
     * `untilMs` is on the **incoming slide's** clock, and `toIndex` is carried with it for the
     * reason `LessonPlayerClient` records: navigating elsewhere resets that clock to zero, leaving
     * the comparison permanently unsatisfied and two slides on screen forever.
     */
    this.#leaving = { node: wrapper, untilMs: authored.durationMs, toIndex: index }
    focusStage()
  }

  /**
   * End the transition on **lesson** time rather than wall-clock.
   *
   * A timer would outlive a seek and survive a paused tab, stranding two stages. Lesson time is what
   * everything else here runs on, and a transition is part of the lesson.
   */
  #settleTransition(slideIndex: number, slideTimeMs: number): void {
    const running = this.#leaving
    if (!running) return
    if (slideIndex === running.toIndex && slideTimeMs < running.untilMs) return
    this.#clearTransition()
  }

  #clearTransition(): void {
    const running = this.#leaving
    this.#leaving = null
    if (!running || !this.#stage) return

    for (const node of [this.#stage]) {
      delete node.dataset['csTransition']
      delete node.dataset['csTransitionType']
      node.style.removeProperty('--cs-transition-ms')
    }
    running.node.replaceWith(this.#stage)
  }

  /**
   * A slide this player can never leave, because leaving needs something it will not draw.
   *
   * Returns a problem in the same shape the kernel uses, so the reporting path does not branch on
   * where the answer came from.
   *
   * **Two cases, and the second was missing until feature 012.** The first was the only one
   * checked: a slide whose advance rule names an interaction this adapter declines. The second is
   * **BR-005**, which outranks every advance mode — *"a required interaction shall override
   * automatic slide advancement until completion"* — and this adapter's `completedInteractions`
   * is permanently empty, because it renders no interactions. So a slide carrying a required
   * question never advances here **whatever its mode**, including a timed one, and nothing
   * reported it: a learner sat on a slide that silently never ended. Shipped in feature 011 and
   * surfaced only when this feature forced a reading of BR-005's scope.
   */
  #uncoveredGate(slide: Slide): { code: string; message: string } | null {
    const elements = slide.elements as readonly { id: string; type: string; payload?: unknown }[]

    const blocking = elements.find(
      (element) =>
        element.type === 'question' &&
        (element.payload as { required?: unknown } | undefined)?.required === true &&
        !covers(element.type),
    )
    if (blocking) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        message:
          'This slide cannot be left until its question is answered, and this player cannot show ' +
          'a question. The lesson cannot go further here — open it in a player that supports ' +
          'questions.',
      }
    }

    const advance = slide.advance as { mode?: string; interactionElementId?: string }
    if (advance.mode !== 'after_interaction') return null

    const gate = elements.find((element) => element.id === advance.interactionElementId)
    if (!gate || covers(gate.type)) return null

    return {
      code: 'ADVANCE_UNSATISFIABLE',
      message:
        `This slide continues once the ${gate.type} on it is answered, and this player cannot show ` +
        `a ${gate.type}. The lesson cannot go further here — open it in a player that supports ` +
        'questions.',
    }
  }

  /**
   * A button's capability, built here because this adapter has no props to thread and already
   * holds the transport in the method that would raise the signal.
   *
   * Its own implementation rather than the player's: sharing would mean depending on
   * `@cuestack/react`, which fails FR-013 structurally. What it must not do is answer the
   * "may they leave" question itself — that rule is the kernel's, and `learnerMayLeave` is the
   * form of it that can be asked without recording a decision.
   */
  #navigationFor(element: ResolvedElement): NavigationAccess | undefined {
    if (element.type !== 'button') return undefined
    const action = (element.payload as { action?: string } | undefined)?.action
    if (!action || action === 'open_url') return undefined

    const manifest = this.#manifest
    const transport = this.#transport
    if (!manifest || !transport) return { act: () => undefined, available: false }

    const index = transport.slideIndex
    const active = manifest.slides[index] as Slide | undefined
    const mayLeave =
      active !== undefined &&
      learnerMayLeave(active, {
        // A query about whether anything would refuse, not the asking itself.
        learnerAdvanced: false,
        // Permanently empty: this adapter renders no interactions, so a learner cannot have
        // completed one. That is the true answer, and it is what makes a required question a
        // wall here rather than something a button could step over.
        completedInteractions: new Set<string>(),
      })

    const available =
      action === 'next_slide'
        ? mayLeave && index < manifest.slides.length - 1
        : action === 'previous_slide'
          ? index > 0
          : true

    return {
      available,
      act: () => {
        if (!available) return
        if (action === 'previous_slide') {
          transport.goToSlide(index - 1)
          return
        }
        if (action === 'replay_slide') {
          // Never `restart()`: it resets the clock without bumping the visit, so the controller
          // still holds the slide as decided and it never advances again.
          transport.goToSlide(index)
          return
        }
        if (active?.advance.mode === 'on_click') {
          this.#learnerAdvanced = true
          return
        }
        transport.goToSlide(index + 1)
      },
    }
  }

  /**
   * A learner on a slide that can never be left must be told — and this adapter has to work it out
   * itself, which was not obvious until it was built.
   *
   * `resolve` reports a blocking problem when a required interaction's type is **unregistered**. That
   * is not this situation: `question` is one of the seven and the kernel knows it perfectly well.
   * What the kernel cannot know is that *this adapter* declines to render it. From its point of view
   * nothing is wrong, so `state.blocked` stays null and a learner sits on a slide that never ends.
   *
   * So the adapter compares the slide's advance rule against its own covered set. The kernel's
   * answer is still honoured when it has one — an unregistered type is a real blocking problem and
   * says so in the kernel's own words rather than in a second set.
   */
  /**
   * The problem this slide has *right now*, rendered from state rather than appended once.
   *
   * **The first version appended a notice and deduped with a `Set` keyed `slideId:code`, and it was
   * wrong in two directions.** The notice was never removed, so it followed a learner onto the next
   * slide and told them to answer a question that was not there. And the key outlived the visit it
   * described, so a learner who came back to the same wall was told nothing at all.
   *
   * Both were unreachable until `seekToSlide` shipped — the only stranding fixture gated on a
   * question and therefore never advanced, so nothing in the suite could leave a problem behind.
   *
   * The shape here follows `LessonPlayerClient`, which recomputes its `reach` every step and calls
   * `setUnreachable(reach)` whenever the code changes, *including to null*. That is why the React
   * player cannot have this bug: a value derived each frame has nowhere for staleness to live. An
   * imperative adapter has to do the removal by hand, and the removal is the half that gets
   * forgotten. **That is a genuine finding about the boundary rather than a slip** — it is the sort
   * of thing a second adapter exists to surface.
   *
   * Reporting still happens once per visit, not once per frame: the *code* is compared, so an
   * unchanged problem is silent, and returning to a slide re-enters through `#enterSlide`, which
   * clears the memory of what was shown.
   */
  #reportProblems(state: ReturnType<typeof resolve>, slide: Slide): void {
    const slideId = slide.id
    const blocking = state.blocked ?? this.#uncoveredGate(slide)
    const code = blocking?.code ?? null
    if (code === this.#shownProblem) return
    this.#shownProblem = code

    this.#stage?.querySelector('[data-cs-problem]')?.remove()
    if (!blocking) return

    const notice = document.createElement('p')
    notice.className = 'cs-problem'
    notice.setAttribute('data-cs-problem', blocking.code)
    // `alert`, not `status`, and for the reason `PlaybackProblem.tsx` gives: this *is* an
    // interruption. The lesson stops here. A polite region waits for a pause that never comes.
    notice.setAttribute('role', 'alert')
    notice.textContent = blocking.message
    this.#stage?.append(notice)

    this.#emit('cuestack:problem', {
      code: blocking.code,
      message: blocking.message,
      slideId,
    })
  }

  /**
   * One dispatch path, so every event bubbles and composes without anybody remembering to.
   *
   * **Composed matters more than bubbling here.** Without it an event stops at the shadow boundary,
   * and a host listening on the container it created hears nothing at all — the failure looks like
   * the element being broken rather than like a flag being absent.
   */
  #emit(type: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }))
  }

  /** A problem with no slide behind it — a fetch that failed before there was a lesson. */
  #report(problem: { code: string; message: string }): void {
    const notice = document.createElement('p')
    notice.className = 'cs-problem'
    notice.setAttribute('data-cs-problem', problem.code)
    notice.setAttribute('role', 'alert')
    notice.textContent = problem.message
    this.#stage?.append(notice)
    this.#emit('cuestack:problem', problem)
  }
}
