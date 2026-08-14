import { RENDER_STATE_VERSION, type ElementPlugin } from './contract.js'

export interface ElementRegistry {
  get(type: string): ElementPlugin | undefined
  has(type: string): boolean
  register(plugin: ElementPlugin): void
  types(): readonly string[]
}

const REQUIRED: ReadonlyArray<keyof ElementPlugin> = [
  'type',
  'schema',
  'resolve',
  'inspector',
  'validate',
  'renderStateVersion',
]

function assertComplete(plugin: ElementPlugin): void {
  const missing = REQUIRED.filter((key) => plugin?.[key] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `Element plugin "${plugin?.type ?? '<unnamed>'}" registration incomplete: ` +
        `missing ${missing.join(', ')}. All members are required — a plugin without an ` +
        'inspector is invisible in the editor, and one without a validator passes ' +
        'publication checks it should fail.',
    )
  }
  if (plugin.renderStateVersion !== RENDER_STATE_VERSION) {
    throw new Error(
      `Element plugin "${plugin.type}" targets RenderState version ` +
        `${plugin.renderStateVersion}, but this kernel provides ${RENDER_STATE_VERSION}. ` +
        'Refusing rather than composing a contribution shaped for a different contract.',
    )
  }
}

export function createElementRegistry(plugins: readonly ElementPlugin[] = []): ElementRegistry {
  const map = new Map<string, ElementPlugin>()
  for (const p of plugins) {
    assertComplete(p)
    map.set(p.type, p)
  }
  return {
    get: (type) => map.get(type),
    has: (type) => map.has(type),
    register(plugin) {
      assertComplete(plugin)
      map.set(plugin.type, plugin)
    },
    types: () => [...map.keys()].sort(),
  }
}
