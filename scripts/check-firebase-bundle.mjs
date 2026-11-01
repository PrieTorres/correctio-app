import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Texts that exist only in the demo of GitHub Pages: its teacher, the mark of
 * its seed, its notice, the demonstration sheets and the sample exam. Any of
 * them in the Firebase build means simulated data reached production (#51).
 */
const DEMO_ONLY = ['teacher-demo', 'seeded-at', 'Dados de demonstração', 'demo-sheets', 'prova-exemplo']

/** The text files of the build; images and WebAssembly carry none of these words. */
const TEXT_FILE = /\.(?:js|css|html|json|txt|map)$/

async function filesUnder(folder) {
  const entries = await readdir(folder, { withFileTypes: true, recursive: true })
  return entries.filter((entry) => entry.isFile() && TEXT_FILE.test(entry.name)).map((entry) => join(entry.parentPath, entry.name))
}

const folder = process.argv[2] ?? 'apps/web/dist'
const found = []
for (const file of await filesUnder(folder)) {
  const content = await readFile(file, 'utf8')
  for (const text of DEMO_ONLY) if (content.includes(text)) found.push(`${file}: "${text}"`)
}

if (found.length > 0) {
  console.error(`The Firebase build carries demo data:\n${found.join('\n')}`)
  process.exit(1)
}
console.log(`Firebase build checked: none of ${DEMO_ONLY.length} demo-only texts in ${folder}.`)
