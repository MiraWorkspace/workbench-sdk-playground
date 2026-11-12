import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { zipSync } from 'fflate'

const root = fileURLToPath(new URL('../', import.meta.url)), dist = join(root, 'dist')
const manifest = JSON.parse(await readFile(join(root, 'miniapp-manifest.json'), 'utf8'))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (manifest.version !== pkg.version) throw new Error('项目与清单版本不一致')
await rm(dist, { recursive: true, force: true }); await mkdir(join(dist, 'vendor'), { recursive: true })
await cp(join(root, 'src'), dist, { recursive: true })
await cp(join(root, 'miniapp-manifest.json'), join(dist, 'miniapp-manifest.json'))
const sdkRoot = dirname(dirname(fileURLToPath(import.meta.resolve('@mira/app-sdk'))))
const sdkPackage = JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8'))
if (sdkPackage.version !== '0.3.0') throw new Error('示例要求 SDK 0.3.0')
await cp(join(sdkRoot, 'dist/index.js'), join(dist, 'vendor/mira-app-sdk.js'))
await cp(join(sdkRoot, 'LICENSE'), join(dist, 'vendor/LICENSE'))
const files = {}
async function collect(directory, prefix = '') {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name, path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path, name + '/')
    else files[name] = new Uint8Array(await readFile(path))
  }
}
await collect(dist)
await mkdir(join(root, 'release'), { recursive: true })
const bytes = zipSync(files), name = `${manifest.id}-${manifest.version}.miniapp`
await writeFile(join(root, 'release', name), bytes)
const sha256 = createHash('sha256').update(bytes).digest('hex')
await writeFile(join(root, 'release', `${name}.sha256`), `${sha256}  ${name}\n`)
console.log(`${join(root, 'release', name)}\n${bytes.length} bytes · ${Object.keys(files).length} files\nSHA-256 ${sha256}`)
