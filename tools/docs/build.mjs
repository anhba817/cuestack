import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

/**
 * The developer documentation site.
 *
 * **It renders the repository's own markdown in place — it does not copy it.** Every page below
 * points at a file that exists for another reason: the root README, the two guides, and the six
 * package READMEs that npm also renders. A site with its own copies would be a second source of
 * truth, and this repository has spent four features removing those.
 *
 * Two things are checked here rather than left to a reader:
 *
 *  - **Every internal link resolves to a page this site has.** `doc-links.test.ts` already proves
 *    each relative link resolves *on disk*; that is a different claim from resolving *on the site*,
 *    because the site's URLs are not the repository's paths. A link that survives one and fails the
 *    other is the stale-claim defect wearing a new coat, so the build fails instead of shipping it.
 *  - **A link to something not published becomes a GitHub URL.** The READMEs point at source files
 *    and at internal documents; those are real destinations, just not pages here.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const OUT = join(ROOT, 'site')
const BLOB = 'https://github.com/anhba817/cuestack/blob/main/'

/** Source of truth for the whole site. Nothing is published that is not listed here. */
const PAGES = [
  { source: 'README.md', url: '', title: 'Cuestack', group: 'Guides', nav: 'Overview' },
  { source: 'docs/packages.md', url: 'packages/', title: 'Packages', group: 'Guides', nav: 'The packages' },
  {
    source: 'docs/authoring-elements.md',
    url: 'authoring-elements/',
    title: 'Authoring elements',
    group: 'Guides',
    nav: 'Authoring elements',
  },
  ...['schema', 'core', 'react', 'element', 'studio', 'adapter-http'].map((name) => ({
    source: `packages/${name}/README.md`,
    url: `packages/${name}/`,
    title: `@cuestack/${name}`,
    group: 'Reference',
    nav: `@cuestack/${name}`,
  })),
]

const bySource = new Map(PAGES.map((p) => [p.source, p]))

/** The first paragraph, as a description. Better than a hand-written one that drifts. */
function summarise(markdown) {
  const line = markdown
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('|'))
  return (line ?? 'Cuestack documentation').replace(/[*`[\]]/g, '').slice(0, 155)
}

/**
 * A repository path becomes a site URL if it is published, and a GitHub URL if it is not.
 *
 * Returns null for anything already absolute, or for a bare anchor.
 */
function rewrite(href, fromSource) {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return null
  const [path, hash] = href.split('#')
  if (!path) return null
  const target = relative(ROOT, resolve(dirname(join(ROOT, fromSource)), path)).replaceAll('\\', '/')
  const page = bySource.get(target)
  const suffix = hash ? `#${hash}` : ''
  return page ? `/${page.url}${suffix}` : `${BLOB}${target}${suffix}`
}

function render(page) {
  const markdown = readFileSync(join(ROOT, page.source), 'utf8')
  const broken = []

  const renderer = new marked.Renderer()
  const baseLink = renderer.link.bind(renderer)
  renderer.link = (token) => {
    const moved = rewrite(token.href, page.source)
    if (moved !== null) {
      // A published page that points at a file which is neither published nor in the repository
      // would 404 twice over. `doc-links.test.ts` covers the repository half.
      if (moved.startsWith(BLOB)) {
        const onDisk = join(ROOT, moved.slice(BLOB.length).split('#')[0])
        try {
          readFileSync(onDisk)
        } catch {
          broken.push(`${token.href} -> ${moved}`)
        }
      }
      return baseLink({ ...token, href: moved })
    }
    return baseLink(token)
  }

  const html = marked.parse(markdown, { renderer, gfm: true })
  return { html, broken, description: summarise(markdown) }
}

function navFor(current) {
  const groups = [...new Set(PAGES.map((p) => p.group))]
  return groups
    .map((group) => {
      const items = PAGES.filter((p) => p.group === group)
        .map((p) => {
          const here = p.url === current ? ' aria-current="page"' : ''
          return `<li><a href="/${p.url}"${here}>${p.nav}</a></li>`
        })
        .join('')
      return `<p class="nav-group">${group}</p><ul>${items}</ul>`
    })
    .join('')
}

const shell = readFileSync(join(HERE, 'shell.html'), 'utf8')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'assets'), { recursive: true })
cpSync(join(HERE, 'docs.css'), join(OUT, 'assets/docs.css'))
// GitHub Pages runs Jekyll unless told not to, and Jekyll ignores directories beginning with _.
writeFileSync(join(OUT, '.nojekyll'), '')

const failures = []
for (const page of PAGES) {
  const { html, broken, description } = render(page)
  if (broken.length > 0) failures.push(`${page.source}: ${broken.join(', ')}`)
  const dir = join(OUT, page.url)
  mkdirSync(dir, { recursive: true })
  const depth = page.url === '' ? '' : '../'.repeat(page.url.split('/').filter(Boolean).length)
  writeFileSync(
    join(dir, 'index.html'),
    shell
      .replace('{{title}}', page.title)
      .replace('{{description}}', description)
      .replace('{{nav}}', navFor(page.url))
      .replace('{{content}}', html)
      .replace('{{source}}', page.source)
      .replaceAll('{{root}}', depth || '/'),
  )
}

if (failures.length > 0) {
  console.error('docs: links that would 404 once published:')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`docs: built ${PAGES.length} pages into site/ from the repository's own markdown.`)
