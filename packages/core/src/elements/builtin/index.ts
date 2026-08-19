import { RENDER_STATE_VERSION, type ElementPlugin, type PluginIssue } from '../contract.js'

/**
 * The seven MVP element types, as complete plugins.
 *
 * Constitution I requires a plugin to supply its full contract — data schema, editor component,
 * player renderer, inspector configuration, and validator — and says partial plugins are rejected.
 * The seven have carried a renderer in `@cuestack/react` and an editor in `@cuestack/studio` since
 * Wave 2, and **no core plugin at all**. Nothing depended on the missing member until PB-1 needed
 * `validate`, at which point the seam turned out to be real and empty (research R-12).
 *
 * Three properties hold across every plugin here, and each is load-bearing.
 *
 * **`resolve` is inert.** `{ visible: true }`, no contribution — which is exactly what
 * `resolve/element.ts` already produces when no plugin exists. A plugin contributing geometry or
 * style would change what every lesson renders, inside a feature whose job is to add *checks*.
 * `elements/inert-resolve.test.ts` asserts the change is invisible.
 *
 * **`inspector` is the canonical field list**, and `@cuestack/studio` derives from it rather than
 * restating it. Two hand-maintained lists joined by a cast is the duplication this whole feature is
 * arranged against (research R-13).
 *
 * **`validate` reports only what the format cannot.** The schema already rejects a correct answer
 * naming no option, so repeating it here would produce two issues for one fault (FR-006c).
 *
 * A note on `schema`: **nothing anywhere calls it.** `assertComplete` requires the member and no
 * code path invokes it, so what follows is a minimal honest guard rather than a second copy of the
 * format. Writing seven elaborate type guards nobody runs would be seven places to drift from the
 * schema they claim to mirror (research R-14).
 */

const isObject = (payload: unknown): payload is Record<string, unknown> =>
  typeof payload === 'object' && payload !== null

const plugin = (
  type: string,
  inspector: ElementPlugin['inspector']['fields'],
  validate: (payload: Record<string, unknown>) => PluginIssue[] = () => [],
): ElementPlugin => ({
  type,
  schema: isObject,
  // Inert by design. See the header.
  resolve: () => ({ visible: true }),
  inspector: { fields: inspector },
  validate: (payload) => (isObject(payload) ? validate(payload) : []),
  renderStateVersion: RENDER_STATE_VERSION,
})

const text = plugin('text', [{ key: 'payload.text', label: 'Text', kind: 'text' }], (payload) =>
  typeof payload['text'] === 'string' && payload['text'].trim() === ''
    ? [
        {
          code: 'TEXT_EMPTY',
          message:
            'This text element has nothing in it. Give it words, or remove it — an empty box is ' +
            'invisible to a learner and takes up space in the layout.',
        },
      ]
    : [],
)

const button = plugin(
  'button',
  [
    { key: 'payload.label', label: 'Label', kind: 'text' },
    {
      key: 'payload.action',
      label: 'Action',
      kind: 'select',
      options: ['next_slide', 'previous_slide', 'replay_slide', 'open_url'],
    },
    { key: 'payload.url', label: 'URL', kind: 'text' },
  ],
  (payload) =>
    // The format permits `open_url` with no url, because `url` is optional for the other three
    // actions. Only the combination is wrong, and only a rule that sees both fields can say so.
    payload['action'] === 'open_url' && typeof payload['url'] !== 'string'
      ? [
          {
            code: 'BUTTON_URL_ABSENT',
            message:
              'This button opens a URL but no address is set, so pressing it would do nothing. ' +
              'Add the address, or choose a different action.',
          },
        ]
      : [],
)

const shape = plugin('shape', [
  { key: 'payload.shape', label: 'Shape', kind: 'select', options: ['rect', 'ellipse', 'line', 'arrow'] },
])

const image = plugin('image', [
  { key: 'payload.asset.assetId', label: 'Image asset', kind: 'asset' },
  { key: 'payload.caption', label: 'Caption', kind: 'text' },
])

const video = plugin('video', [
  { key: 'payload.asset.assetId', label: 'Video asset', kind: 'asset' },
  { key: 'payload.asset.captionTrack', label: 'Captions', kind: 'asset' },
  { key: 'payload.poster', label: 'Poster image', kind: 'asset' },
  { key: 'payload.volume', label: 'Volume', kind: 'number' },
  { key: 'payload.showControls', label: 'Show controls', kind: 'boolean' },
  { key: 'payload.loop', label: 'Loop', kind: 'boolean' },
])

const audio = plugin('audio', [
  { key: 'payload.asset.assetId', label: 'Audio asset', kind: 'asset' },
  { key: 'payload.asset.transcript', label: 'Transcript', kind: 'asset' },
  { key: 'payload.volume', label: 'Volume', kind: 'number' },
  { key: 'payload.showControls', label: 'Show controls', kind: 'boolean' },
])

const question = plugin(
  'question',
  [
    { key: 'payload.prompt', label: 'Question', kind: 'text' },
    {
      key: 'payload.interactionType',
      label: 'Type',
      kind: 'select',
      options: ['multiple_choice', 'true_false'],
    },
    {
      key: 'payload.options',
      label: 'Answer options',
      kind: 'list',
      minItems: 2,
      of: [
        { key: 'id', label: 'ID', kind: 'text' },
        { key: 'label', label: 'Label', kind: 'text' },
      ],
    },
    { key: 'payload.correctResponse', label: 'Correct answer', kind: 'text' },
    { key: 'payload.required', label: 'Must be answered', kind: 'boolean' },
    { key: 'payload.maxAttempts', label: 'Attempts allowed', kind: 'number' },
  ],
  (payload) => {
    const issues: PluginIssue[] = []
    const options = payload['options']

    /**
     * **Only what the format permits reaches here** (FR-006c). An earlier draft of this validator
     * reported a question with fewer than two options; `interactionSchema` declares
     * `options: z.array(optionSchema).min(2)`, so such a question is already rejected and the rule
     * would have produced a second issue for one fault. The same draft's argument — "the format
     * says nothing about how many there are" — was simply untrue, and checking settled it.
     *
     * What the format genuinely cannot say is below: it enforces unique option *ids* and says
     * nothing about their labels, and it enforces two-or-more options for every interaction type
     * including the one whose name fixes the count at two.
     */
    if (Array.isArray(options)) {
      const labels = options.map((option) =>
        typeof (option as { label?: unknown })?.label === 'string'
          ? ((option as { label: string }).label).trim().toLowerCase()
          : '',
      )
      const repeated = labels.find((label, index) => label !== '' && labels.indexOf(label) !== index)
      if (repeated !== undefined) {
        issues.push({
          code: 'QUESTION_OPTIONS_INDISTINGUISHABLE',
          message:
            `Two of this question's answers both read "${repeated}", so a learner choosing ` +
            'between them is guessing. Reword one, or remove it.',
        })
      }

      if (payload['interactionType'] === 'true_false' && options.length !== 2) {
        issues.push({
          code: 'QUESTION_TRUE_FALSE_OPTION_COUNT',
          message:
            `This is a true/false question with ${options.length} answers. Reduce it to two, or ` +
            'change the question type to multiple choice.',
        })
      }
    }

    // `prompt` is `min(1)`, so a single space satisfies the format and reads as no question at all.
    if (typeof payload['prompt'] === 'string' && payload['prompt'].trim() === '') {
      issues.push({
        code: 'QUESTION_PROMPT_EMPTY',
        message: 'This question has no wording, so a learner sees answers and no question. Add the prompt.',
      })
    }
    return issues
  },
)

/** All seven, in the order `ELEMENT_TYPES` declares them. */
export const builtinElements: readonly ElementPlugin[] = [
  text,
  image,
  shape,
  video,
  audio,
  button,
  question,
]
