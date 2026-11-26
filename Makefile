# Thin wrappers around `docker compose` so nothing needs to be installed on the host.
COMPOSE := docker compose
RUN     := $(COMPOSE) run --rm dev
export UID := $(shell id -u)
export GID := $(shell id -g)

.DEFAULT_GOAL := help
.PHONY: help build setup install shell dev sidecars tauri tauri-build build-windows lint lint-fix typecheck test coverage e2e e2e-prod cargo-test cargo-lint check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

build: ## Build the dev Docker image
	$(COMPOSE) build dev

setup: build install ## Build image, install deps and Playwright browsers
	$(RUN) pnpm e2e:install

install: ## Install JS dependencies (pnpm)
	$(RUN) pnpm install

shell: ## Open a shell inside the dev container
	$(RUN) bash

dev: ## Run the Vite dev server on http://localhost:1420 (UI in the browser, mocked backend)
	$(COMPOSE) run --rm --service-ports dev pnpm dev

sidecars: ## Download yt-dlp, ffmpeg, ffprobe and deno for Linux into apps/desktop/src-tauri/binaries
	$(RUN) pnpm sidecars

tauri: sidecars ## Run the native Tauri window (WSLg / X11)
	$(COMPOSE) run --rm tauri

tauri-build: sidecars ## Build Linux bundles (deb, rpm, AppImage) into target/release/bundle
	$(RUN) pnpm tauri build

build-windows: ## Windows installer (.exe, NSIS) via cargo-xwin, copied into release/
	$(RUN) bash -c 'node scripts/fetch-sidecars.mjs x86_64-pc-windows-msvc && pnpm build:windows'
	mkdir -p release && cp target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe release/

lint: ## Biome lint + format check
	$(RUN) pnpm lint

lint-fix: ## Biome autofix
	$(RUN) pnpm lint:fix

typecheck: ## TypeScript type check
	$(RUN) pnpm typecheck

test: ## Unit tests of every package (turbo + Vitest + RTL)
	$(RUN) pnpm test

coverage: ## Unit tests with coverage
	$(RUN) pnpm test:coverage

e2e: ## E2E tests (Playwright, Chromium + WebKit)
	$(RUN) pnpm e2e

e2e-prod: ## E2E against the production build with the desktop CSP
	$(RUN) pnpm e2e:prod

# tauri-build only checks that the sidecars exist: empty placeholders are enough for checks.
PLACEHOLDERS := bash scripts/placeholder-sidecars.sh

cargo-test: ## Rust tests (whole Cargo workspace)
	$(RUN) bash -c '$(PLACEHOLDERS) && cargo test --workspace'

cargo-lint: ## rustfmt + clippy (whole Cargo workspace)
	$(RUN) bash -c '$(PLACEHOLDERS) && cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings'

check: lint typecheck test cargo-lint cargo-test e2e ## Everything CI runs

clean: ## Remove build artifacts (keeps the Rust target/ cache)
	rm -rf apps/*/dist apps/*/coverage packages/*/coverage apps/desktop/playwright-report apps/desktop/test-results .turbo
