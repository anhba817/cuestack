import { RENDER_STATE_VERSION, type ElementPlugin, type PluginIssue } from '../../../src/elements/contract.js'

/**
 * The element type `docs/authoring-elements.md` teaches, and a real one.
 *
 * The guide quotes from this file rather than restating it, and a check compares the two — so a
 * contract change fails the build instead of leaving the guide quietly wrong. That mechanism exists
 * because prose has already failed here: `ElementEditor`'s header described a framework that stopped
 * existing two features ago, through two releases, and the audience for a guide is by definition the
 * people who cannot tell it is wrong.
 *
 * A countdown: a number of seconds, and whether to announce the last few. Chosen because it is
 * obviously not in the format, needs no assets, and has one field the schema could not check for you.
 */

interface CountdownPayload {
  readonly seconds: number
  readonly announceFinal?: boolean
}

// #region payload
const isCountdown = (payload: unknown): payload is CountdownPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as CountdownPayload).seconds === 'number'
// #endregion payload

// #region plugin
export const countdownPlugin: ElementPlugin<CountdownPayload> = {
  type: 'countdown',

  /** A guard over your own payload. It answers "is this mine", not "is this a lesson". */
  schema: isCountdown,

  /**
   * What this type contributes to a rendered frame — and this one contributes nothing visual,
   * because an example that changed what lessons look like would be teaching by side effect.
   *
   * Note what a plugin is given: a payload, a geometry, a slide time, and a theme. Not the lesson,
   * not the slide, not its siblings, not the transport, and nothing about the learner. That is
   * enforced by the signature rather than by documentation — there is nowhere to reach for the data.
   * The restriction is not distrust: a plugin *able* to read the whole lesson becomes one that does,
   * and then the lesson shape cannot change without breaking third-party code.
   */
  resolve: () => ({ visible: true }),

  /** The fields an author edits. This is the one place your type's field list is declared. */
  inspector: {
    fields: [
      { key: 'payload.seconds', label: 'Seconds', kind: 'number' },
      { key: 'payload.announceFinal', label: 'Announce the final seconds', kind: 'boolean' },
    ],
  },

  /**
   * Only what the format cannot already reject.
   *
   * The format checks types and required fields; it does not know that a countdown of zero counts
   * nothing. Re-checking what the schema checks means one fault produces two issues, which is the
   * duplication a validation engine exists to avoid.
   */
  validate(payload): readonly PluginIssue[] {
    if (payload.seconds > 0) return []
    return [
      {
        code: 'COUNTDOWN_HAS_NO_TIME',
        message:
          'This countdown is set to zero seconds, so a learner sees it finish before it starts. ' +
          'Give it a duration, or remove it.',
      },
    ]
  },

  /** Refuses a contribution shaped for a different kernel rather than composing it. */
  renderStateVersion: RENDER_STATE_VERSION,
}
// #endregion plugin
