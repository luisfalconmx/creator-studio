/**
 * Release helpers shared by CI (Windows/Linux/macOS) and `pnpm release:mac`.
 *
 * - Installers are published without the version in their name
 *   (`CreatorStudio_x64-setup.exe`, `CreatorStudio_aarch64.dmg`…), so
 *   `releases/latest/download/<name>` is a permanent download link.
 * - `latest.json` is the manifest the in-app updater reads: one entry per
 *   platform with the signed update file. Each publish merges its platforms
 *   into the manifest already attached to the release.
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const REPO = 'luisfalconmx/creator-studio'

/** What each build target produces, and how it is renamed. */
const TARGETS = {
  'x86_64-pc-windows-msvc': {
    files: [
      {
        dir: 'nsis',
        match: /-setup\.exe$/,
        name: 'CreatorStudio_x64-setup.exe',
        updater: 'windows-x86_64',
      },
      { dir: 'msi', match: /\.msi$/, name: 'CreatorStudio_x64.msi' },
    ],
  },
  'x86_64-unknown-linux-gnu': {
    files: [
      {
        dir: 'appimage',
        match: /\.AppImage$/,
        name: 'CreatorStudio_amd64.AppImage',
        updater: 'linux-x86_64',
      },
      { dir: 'deb', match: /\.deb$/, name: 'CreatorStudio_amd64.deb' },
      { dir: 'rpm', match: /\.rpm$/, name: 'CreatorStudio.x86_64.rpm' },
    ],
  },
  'aarch64-apple-darwin': {
    files: [
      { dir: 'dmg', match: /\.dmg$/, name: 'CreatorStudio_aarch64.dmg' },
      {
        dir: 'macos',
        match: /\.app\.tar\.gz$/,
        name: 'CreatorStudio_aarch64.app.tar.gz',
        updater: 'darwin-aarch64',
      },
    ],
  },
  'x86_64-apple-darwin': {
    files: [
      { dir: 'dmg', match: /\.dmg$/, name: 'CreatorStudio_x64.dmg' },
      {
        dir: 'macos',
        match: /\.app\.tar\.gz$/,
        name: 'CreatorStudio_x64.app.tar.gz',
        updater: 'darwin-x86_64',
      },
    ],
  },
}

/**
 * Copies the bundles of `target` into `outDir` with their final names and
 * returns the updater platforms they provide.
 */
export function collect({ bundleDir, target, tag, outDir }) {
  const spec = TARGETS[target]
  if (!spec) throw new Error(`Target sin configurar: ${target}`)
  mkdirSync(outDir, { recursive: true })
  const files = []
  const platforms = {}
  for (const f of spec.files) {
    const dir = join(bundleDir, f.dir)
    const found = existsSync(dir) ? readdirSync(dir).filter((n) => f.match.test(n)) : []
    if (found.length !== 1)
      throw new Error(`Se esperaba 1 archivo ${f.match} en ${dir}, hay ${found.length}`)
    const dest = join(outDir, f.name)
    copyFileSync(join(dir, found[0]), dest)
    files.push(dest)
    if (f.updater) {
      const sig = join(dir, `${found[0]}.sig`)
      if (!existsSync(sig)) {
        throw new Error(
          `Falta la firma ${sig}. ¿Se compiló con --config src-tauri/tauri.release.conf.json y TAURI_SIGNING_PRIVATE_KEY?`,
        )
      }
      platforms[f.updater] = {
        signature: readFileSync(sig, 'utf8').trim(),
        url: `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(f.name)}`,
      }
    }
  }
  return { files, platforms }
}

const gh = (args, opts = {}) =>
  execFileSync('gh', ['--repo', REPO, ...args], { encoding: 'utf8', ...opts })

/**
 * Creates the release if needed, uploads `files` and merges `platforms` into
 * the release's `latest.json`.
 */
export function publish({ tag, version, files, platforms, notes }) {
  try {
    gh(['release', 'view', tag], { stdio: 'pipe' })
  } catch {
    gh(['release', 'create', tag, '--title', `Creator Studio ${tag}`, '--notes', notes ?? ''], {
      stdio: 'inherit',
    })
  }
  if (files.length) gh(['release', 'upload', tag, ...files, '--clobber'], { stdio: 'inherit' })

  const work = join(tmpdir(), `creator-studio-${tag}-${process.pid}`)
  mkdirSync(work, { recursive: true })
  const manifestPath = join(work, 'latest.json')
  let manifest = { platforms: {} }
  try {
    gh(['release', 'download', tag, '--pattern', 'latest.json', '--dir', work, '--clobber'], {
      stdio: 'pipe',
    })
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    /* first publish of this release */
  }
  manifest = {
    version,
    notes: `Creator Studio ${tag}`,
    pub_date: new Date().toISOString(),
    platforms: { ...manifest.platforms, ...platforms },
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  gh(['release', 'upload', tag, manifestPath, '--clobber'], { stdio: 'inherit' })
  console.log(`latest.json → ${Object.keys(manifest.platforms).sort().join(', ')}`)
}

/** The app version lives in apps/desktop/package.json (tauri.conf.json reads it from there). */
export function readVersion(root) {
  return JSON.parse(readFileSync(resolve(root, 'apps/desktop/package.json'), 'utf8')).version
}

/** Cargo workspace: every crate builds into the root `target/` folder. */
export const bundleDirFor = (root, target) => join(root, 'target', target, 'release/bundle')

/**
 * The `## [version]` section of CHANGELOG.md (without its heading). Every release
 * needs one: this throws when it's missing, so a release can't ship without a changelog.
 */
export function changelogFor(root, version) {
  const text = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
  const escaped = version.replace(/[.]/g, '\\.')
  const match = text.match(
    new RegExp(
      `^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|^\\[[^\\]]+\\]: |(?![\\s\\S]))`,
      'm',
    ),
  )
  const body = match?.[1].trim()
  if (!body) {
    throw new Error(
      `CHANGELOG.md no tiene una sección "## [${version}]". Escribe el changelog de esta versión antes de publicarla.`,
    )
  }
  return body
}

/** GitHub release notes: the version's changelog followed by the download links. */
export function releaseNotes(root, version) {
  return `${changelogFor(root, version)}\n\n${DOWNLOADS}`
}

const DOWNLOADS = `## Descargas

| Sistema | Archivo |
| --- | --- |
| macOS (Apple Silicon M1–M4) | [CreatorStudio_aarch64.dmg](https://github.com/${REPO}/releases/latest/download/CreatorStudio_aarch64.dmg) |
| macOS (Intel) | [CreatorStudio_x64.dmg](https://github.com/${REPO}/releases/latest/download/CreatorStudio_x64.dmg) |
| Windows | [CreatorStudio_x64-setup.exe](https://github.com/${REPO}/releases/latest/download/CreatorStudio_x64-setup.exe) o \`.msi\` |
| Linux | [CreatorStudio_amd64.AppImage](https://github.com/${REPO}/releases/latest/download/CreatorStudio_amd64.AppImage), \`.deb\` o \`.rpm\` |

Una vez instalada, Creator Studio avisa sola cuando hay una versión nueva y se actualiza con un clic (en Linux, con la AppImage).

**macOS:** la app no está firmada con un certificado de Apple. Si macOS dice que está dañada, ejecuta
\`xattr -cr "/Applications/Creator Studio.app"\` una vez tras instalarla.

**Windows:** si SmartScreen la bloquea, pulsa «Más información» → «Ejecutar de todas formas».`
