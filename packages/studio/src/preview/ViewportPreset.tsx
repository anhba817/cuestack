'use client'

import type { ReactNode } from 'react'
import { PREVIEW_PRESETS, PREVIEW_PRESET_ORDER, type ViewportPreset as Preset } from './constants.js'

export interface ViewportPresetProps {
  readonly value: Preset
  readonly onChange: (preset: Preset) => void
}

/**
 * Desktop, tablet, mobile — a width on the preview's own wrapper, and nothing else.
 *
 * **Not on the stage.** `.cs-stage` *is* the container — `container-type: size` — and it
 * declares its own `aspect-ratio` from the lesson's canvas, so a control in this frame both
 * cannot and must not style it. Constraining the wrapper is enough: geometry is logical and
 * every dimension beneath the stage is in container query units, so the lesson rescales
 * itself and no stored value moves (FR-023).
 *
 * A **width**, not a maximum. The preview is a `<dialog>`, whose suggested rendering is
 * `width: fit-content`, so a maximum would cap an element with no width of its own and the
 * preview would end up as wide as this control row.
 *
 * What a preset actually shows is the player's legibility floor. Because the lesson scales
 * proportionally, a smaller preview is otherwise the same picture — the one thing that
 * changes is `max(12px, …)` on type, which takes over below roughly 600 px for body text on
 * a 1600-wide canvas. That is what "does the slide hold together on a phone" means here, and
 * the widths in `constants.ts` are chosen to straddle it.
 *
 * Deliberately *not* emulation: no touch simulation, no user-agent spoofing, no device
 * chrome. Emulation that is not faithful is worse than none, because it invites conclusions
 * it cannot support.
 */
export function ViewportPreset({ value, onChange }: ViewportPresetProps): ReactNode {
  return (
    <fieldset className="cs-preview-preset" data-cs-preview-preset-control>
      <legend>Preview size</legend>
      {PREVIEW_PRESET_ORDER.map((preset) => (
        <label key={preset}>
          <input
            type="radio"
            name="cs-preview-preset"
            value={preset}
            checked={value === preset}
            onChange={() => onChange(preset)}
          />
          {`${preset} (${PREVIEW_PRESETS[preset]}px)`}
        </label>
      ))}
    </fieldset>
  )
}
