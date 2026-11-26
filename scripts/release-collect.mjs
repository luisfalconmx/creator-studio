#!/usr/bin/env node
/**
 * CI step: renames the bundles of one target and writes its updater entries.
 * Usage: node scripts/release-collect.mjs <target> <outDir>
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleDirFor, changelogFor, collect, readVersion } from './release-lib.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [target, outDir] = process.argv.slice(2)
if (!target || !outDir) throw new Error('Uso: release-collect.mjs <target> <outDir>')

const version = readVersion(ROOT)
changelogFor(ROOT, version) // a release without its CHANGELOG.md entry fails here, before uploading
const tag = `v${version}`
const bundleDir = bundleDirFor(ROOT, target)
const { platforms } = collect({ bundleDir, target, tag, outDir })
writeFileSync(join(outDir, `platforms-${target}.json`), JSON.stringify(platforms, null, 2))
console.log(`${target}: ${Object.keys(platforms).join(', ')}`)
