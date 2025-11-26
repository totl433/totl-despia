#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const pagesDir = join('src', 'pages')
const componentDir = join('src', 'components')

const componentFiles = readdirSync(componentDir).filter(
  (file) => file.endsWith('.tsx') && !file.endsWith('.stories.tsx'),
)

const pageFiles = readdirSync(pagesDir).filter((file) => file.endsWith('.tsx'))

const pageMap = {}
for (const file of pageFiles) {
  const fullPath = join(pagesDir, file)
  const source = readFileSync(fullPath, 'utf8')
  const imports = [...source.matchAll(/import\s+([^;]+)\s+from\s+['"]\.\.\/components\/([^'";]+)['"]/g)]
  const names = new Set()
  for (const [, specifiers] of imports) {
    const cleaned = specifiers
      .replace(/[{}]/g, '')
      .split(',')
      .map((item) => item.trim().split(' as ')[0]?.trim())
      .filter(Boolean)
    cleaned.forEach((name) => names.add(name))
  }
  pageMap[file] = [...names].sort()
}

const totalComponents = componentFiles.length

console.log('Found %d component modules in src/components\n', totalComponents)
console.log('Page -> component usage (imports from ../components):')
for (const file of pageFiles.sort()) {
  const used = pageMap[file]
  const label = used.length ? used.join(', ') : '(none)'
  console.log(`- ${file}: ${label}`)
}

console.log('\nTip: run `npm run storybook` to browse the visual catalogue.')
