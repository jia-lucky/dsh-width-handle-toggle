import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (pkg.type !== 'module') errors.push('package.json: type must be "module"')
if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.client) errors.push('package.json: missing dsh.bundle / dsh.client')
if (pkg.dsh.client && pkg.dsh.client.platform !== 'web') errors.push('package.json: dsh.client.platform must be "web"')
if (!pkg.exports || !pkg.exports['./client']) errors.push('package.json: exports["./client"] is required by client-modules')

for (const file of ['lib/index.js', 'lib/client.js', 'lib/widget.js', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
  if (!existsSync(join(root, file))) errors.push('missing file: ' + file)
}

const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
if (!patch.includes('dsh-width-handle-toggle')) errors.push('cordis.patch.yml: entry id missing')

const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
if (!client.includes('__ModuleLoader__.load')) errors.push('lib/client.js: not a client-module bundle')
if (!client.includes('settings.section')) errors.push('lib/client.js: does not register settings.section')

const widget = readFileSync(join(root, 'lib/widget.js'), 'utf8')
if (widget.includes('</script')) errors.push('lib/widget.js: must not contain a closing script tag (inlined row)')

for (const file of ['lib/index.js', 'lib/client.js', 'lib/widget.js']) {
  try {
    new Function(readFileSync(join(root, file), 'utf8'))
  } catch (error) {
    if (file.endsWith('index.js')) continue
    errors.push(file + ': ' + String(error && error.message))
  }
}

if (errors.length) {
  console.error('check failed:')
  for (const line of errors) console.error(' - ' + line)
  process.exit(1)
}
console.log('check ok: ' + pkg.name + '@' + pkg.version)
