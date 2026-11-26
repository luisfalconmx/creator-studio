import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement object URLs
let urlCounter = 0
URL.createObjectURL ??= vi.fn(() => `blob:mock/${urlCounter++}`)
URL.revokeObjectURL ??= vi.fn()

afterEach(() => {
  cleanup()
})

// Browser APIs jsdom doesn't implement (used by HeroUI, motion and the section layouts)
window.matchMedia ??= vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollTo ??= vi.fn()
