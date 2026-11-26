# Creator Studio

All-in-one desktop app for media content: **Videos** (video editor + metadata manager, formerly
ClipStudio), **Imágenes** (image optimizer, formerly Pixelair) and **Descargas** (yt-dlp downloader,
formerly Streamline). Tauri 2 + Vite + React 19 + HeroUI v3 + Tailwind v4, in a Turborepo + pnpm
monorepo with a Cargo workspace.

## Rules

- **Never install tooling on the host.** Run everything through Docker: `make <target>` or
  `docker compose run --rm dev <cmd>` (e.g. `docker compose run --rm dev pnpm --filter @creator-studio/images add zod`).
- Package manager is **pnpm** only. Tasks run through **turbo** (`pnpm typecheck`, `pnpm test`, `pnpm build`).
- Commits follow Conventional Commits; scopes are listed in `commitlint.config.ts`.
- **Every `.exe` you build must end up in `release/`** (repo root, git-ignored). `make build-windows`
  copies the NSIS installer there; if you build another way, copy
  `target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe` into `release/` yourself.
- Before finishing a change run `make lint typecheck test` (and `make e2e` / `make cargo-lint cargo-test` when relevant).
- UI text is in **Spanish**. The look & feel is ClipStudio's: dark, red `#E7000B` accent, glass panels,
  Inter, `@gravity-ui/icons`. Reuse `@creator-studio/ui` (`AppHeader`, `Panel`, `DropZone`, `PageBackdrop`…).

## Layout

```
apps/desktop/            Tauri app: shell (rail + sections), updater, e2e, src-tauri (single binary)
packages/ui/             Theme (styles.css), shared components, SectionActiveContext, unsaved-changes guard
packages/videos/         Videos section  → <VideosApp />   (Rust: crates/videos,    plugin `videos`)
packages/images/         Images section  → <ImagesApp />   (Rust: crates/images,    plugin `images`)
packages/downloads/      Downloads       → <DownloadsApp /> (Rust: crates/downloads, plugin `downloads`)
crates/*                 Each backend is a Tauri plugin: commands are `plugin:<name>|<command>`
scripts/                 Sidecars (yt-dlp, ffmpeg, ffprobe, deno) and release scripts
```

## Conventions

- Formatting/linting: Biome (2 spaces, single quotes, no semicolons, width 100). Don't add ESLint/Prettier.
  Code ported from ClipStudio/Streamline has a few rules downgraded to warnings in `biome.json`; fix them
  when touching that code, don't add new ones.
- Frontend packages are source-only (no build step): `exports` point at `src/`. Tailwind scans them via
  `@source` in `apps/desktop/src/index.css`.
- Sections stay mounted when hidden. Anything global (keyboard shortcuts, drag & drop, animation loops)
  must check `useSectionActive()` so only the visible section reacts.
- Unit tests sit next to the code as `*.test.ts(x)` (Vitest globals + RTL + jest-dom, shared setup in
  `packages/ui/src/test/setup.ts`). E2E specs live in `apps/desktop/e2e/` against the Vite dev server (port 1420).
- Rust: add a command in the crate, list it in the crate's `build.rs` `COMMANDS` and in
  `permissions/default.toml`, then call it as `invoke('plugin:<crate>|<command>')`. Must pass
  `cargo fmt` + `clippy -D warnings`. App-level permissions go in `apps/desktop/src-tauri/capabilities/default.json`.
- ffmpeg/ffprobe, yt-dlp and deno are bundled as sidecars (`pnpm sidecars`); both Videos and Downloads
  find them next to the executable.

## Releases and changelog (mandatory)

**Every release must come with a changelog of that version's changes.** Any agent (Claude or other AI)
preparing a release must:

1. Update `CHANGELOG.md` *before* bumping the version: move the items from `## [Sin publicar]` into a new
   `## [x.y.z] - YYYY-MM-DD` section (Keep a Changelog, in Spanish, grouped under `### Agregado`,
   `### Cambiado`, `### Corregido`, `### Eliminado`), written for users, not as a commit list. Build it
   from `git log vPREV..HEAD` and the diff; update the compare links at the bottom.
2. Bump the version with `pnpm version x.y.z` (the `version` script syncs `apps/desktop`, `packages/*`,
   `Cargo.toml` and `Cargo.lock`), commit as `chore(release): vx.y.z`, tag `vx.y.z` and push with tags.
3. The release notes on GitHub are generated from that `CHANGELOG.md` section
   (`scripts/release-lib.mjs` → `releaseNotes()`); publishing fails if the section is missing.

While working (not releasing), add notable user-facing changes under `## [Sin publicar]`.
