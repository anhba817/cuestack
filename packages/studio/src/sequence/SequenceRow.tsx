import type { ReactNode } from 'react'
import type { SequenceEvent } from './events.js'
import type { SequenceRelationship } from '../draft/edit.js'

export interface SequenceRowProps {
  readonly event: SequenceEvent
  readonly relationship: SequenceRelationship
  readonly first: boolean
  readonly disabled: boolean
  readonly onChoose: (kind: SequenceRelationship['kind']) => void
  readonly onDelay: (delayMs: number) => void
}

const seconds = (ms: number): string => (ms / 1000).toFixed(2)

/**
 * One event, what it is waiting for, and when it actually happens.
 *
 * The absolute time is shown beside the relationship rather than hidden behind it. "Simple
 * first, precision on demand" (§7.1) does not mean concealing the number — a teacher who
 * cannot see when something happens has to open the timeline to find out, which is the
 * expertise this mode exists to avoid demanding.
 *
 * **Custom is offered as a choice, never selected as one.** It is what the classifier
 * *reports* when no simple relationship describes the timing, so choosing it would mean
 * "make this not match any relationship", which is not an operation.
 */
export function SequenceRow({
  event,
  relationship,
  first,
  disabled,
  onChoose,
  onDelay,
}: SequenceRowProps): ReactNode {
  const label = `${event.kind === 'effect' ? 'Effect' : 'Element'}: ${event.label}`

  return (
    <li className="cs-sequence-row" aria-label={label} data-testid={`cs-seq-${event.elementId}${event.effectId ? `:${event.effectId}` : ''}`}>
      <span className="cs-sequence-label">{event.label}</span>

      {first ? (
        <span className="cs-sequence-first">Starts at the beginning of the slide</span>
      ) : (
        <label>
          Starts
          <select
            value={relationship.kind}
            disabled={disabled}
            onChange={(e) => onChoose(e.currentTarget.value as SequenceRelationship['kind'])}
          >
            <option value="with-previous">with the previous</option>
            <option value="after-previous">after the previous</option>
            <option value="after-previous-delay">after the previous, with a delay</option>
            {/* Reported, not chosen — see the note above. Present so the control can show it. */}
            {relationship.kind === 'custom' ? <option value="custom">custom</option> : null}
          </select>
        </label>
      )}

      {relationship.kind === 'after-previous-delay' ? (
        <label>
          Delay (ms)
          <input
            type="number"
            min={1}
            value={relationship.delayMs}
            disabled={disabled}
            onChange={(e) => onDelay(Number(e.currentTarget.value))}
          />
        </label>
      ) : null}

      <span className="cs-sequence-at">{`at ${seconds(event.startMs)}s`}</span>
    </li>
  )
}
