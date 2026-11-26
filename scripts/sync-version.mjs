#!/usr/bin/env node
/**
 * Copies the root package.json version to every place that stores it:
 * apps/desktop/package.json (read by tauri.conf.json), packages/*, the Cargo
 * workspace and the workspace crates in Cargo.lock.
 *
 * Runs automatically on `pnpm version <x.y.z>` (the `version` lifecycle script),
 * or by hand: node scripts/sync-version.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const { version } = JSON.parse(read('package.json'))

const manifests = [
  'apps/desktop/package.json',
  ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/package.json`),
]
for (const file of manifests) {
  const pkg = JSON.parse(read(file))
  pkg.version = version
  writeFileSync(join(ROOT, file), `${JSON.stringify(pkg, null, 2)}\n`)
}

// [workspace.package] version
const cargo = read('Cargo.toml').replace(
  /(\[workspace\.package\][^[]*?\nversion = ")[^"]+(")/,
  `$1${version}$2`,
)
writeFileSync(join(ROOT, 'Cargo.toml'), cargo)

// Workspace crates in Cargo.lock
const crates = [
  'creator-studio',
  'tauri-plugin-videos',
  'tauri-plugin-images',
  'tauri-plugin-downloads',
]
let lock = read('Cargo.lock')
for (const name of crates) {
  lock = lock.replace(
    new RegExp(`(\\[\\[package\\]\\]\\nname = "${name}"\\nversion = ")[^"]+(")`),
    `$1${version}$2`,
  )
}
writeFileSync(join(ROOT, 'Cargo.lock'), lock)

console.log(`Versión ${version} → ${manifests.length} package.json, Cargo.toml y Cargo.lock`)
